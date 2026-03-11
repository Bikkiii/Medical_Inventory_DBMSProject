const express  = require("express");
const router   = express.Router();
const db       = require("../config/db");
const validate = require("../middleware/validate");

// GET /api/sales
// Returns all sales with the pharmacist name joined
router.get("/", async (req, res, next) => {
  try {
    const [rows] = await db.query(`
      SELECT
        s.sale_id,
        s.sale_date,
        s.customer_name,
        s.customer_phone,
        u.full_name AS served_by,
        s.total_amount,
        s.payment_mode,
        s.sale_status
      FROM sale s
      JOIN user u ON u.user_id = s.served_by
      ORDER BY s.sale_id DESC
    `);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/sales/:id
// Returns one sale with all its line items
router.get("/:id", async (req, res, next) => {
  try {
    const [sales] = await db.query(`
      SELECT s.*, u.full_name AS served_by_name
      FROM sale s
      JOIN user u ON u.user_id = s.served_by
      WHERE s.sale_id = ?
    `, [req.params.id]);

    if (sales.length === 0) return res.status(404).json({ error: "Sale not found." });

    const [items] = await db.query(`
      SELECT
        si.sale_item_id,
        m.medicine_name,
        b.batch_no,
        si.quantity_sold,
        si.unit_price,
        si.discount_pct,
        si.subtotal
      FROM sale_item si
      JOIN medicine   m  ON m.medicine_id    = si.medicine_id
      JOIN batch_item bi ON bi.batch_item_id = si.batch_item_id
      JOIN batch      b  ON b.batch_id       = bi.batch_id
      WHERE si.sale_id = ?
    `, [req.params.id]);

    res.json({ ...sales[0], items });
  } catch (err) {
    next(err);
  }
});

// POST /api/sales
// Calls sp_process_sale — inserts sale + sale_item, triggers stock deduction
router.post("/", async (req, res, next) => {
  try {
    const {
      customer_name,
      customer_phone,
      served_by,
      payment_mode,
      batch_item_id,
      medicine_id,
      quantity_sold,
      unit_price,
      discount_pct,
    } = req.body;

    validate(customer_name, "customer_name is required");
    validate(served_by,     "served_by (user_id) is required");
    validate(payment_mode,  "payment_mode is required");
    validate(batch_item_id, "batch_item_id is required");
    validate(medicine_id,   "medicine_id is required");
    validate(quantity_sold, "quantity_sold is required");
    validate(unit_price,    "unit_price is required");

    // sp_process_sale handles the transaction internally.
    // trg_before_sale_item_insert will raise 45000 if stock is insufficient.
    // trg_after_sale_item_insert will write the stock_ledger entry.
    const [result] = await db.query("CALL sp_process_sale(?, ?, ?, ?, ?, ?, ?, ?, ?)", [
      customer_name,
      customer_phone  || null,
      served_by,
      payment_mode,
      batch_item_id,
      medicine_id,
      quantity_sold,
      unit_price,
      discount_pct    || 0,
    ]);

    // sp_process_sale returns a result set with created_sale_id
    const sale_id = result[0]?.[0]?.created_sale_id;
    res.status(201).json({ message: "Sale completed.", sale_id });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
