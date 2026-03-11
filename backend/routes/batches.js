const express = require("express");
const router = express.Router();
const db = require("../config/db");
const validate = require("../middleware/validate");

// GET /api/batches
// Returns all batches with supplier name joined
router.get("/", async (req, res, next) => {
  try {
    const [rows] = await db.query(`
      SELECT
        b.batch_id,
        b.batch_no,
        b.order_date,
        b.received_date,
        b.invoice_no,
        b.invoice_amount,
        b.batch_status,
        b.notes,
        s.supplier_name,
        u1.full_name AS ordered_by,
        u2.full_name AS received_by
      FROM batch b
      JOIN supplier s      ON s.supplier_id = b.supplier_id
      JOIN user     u1     ON u1.user_id    = b.ordered_by
      LEFT JOIN user u2    ON u2.user_id    = b.received_by
      ORDER BY b.batch_id DESC
    `);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/batches/:id
// Returns one batch with all its items
router.get("/:id", async (req, res, next) => {
  try {
    const [batches] = await db.query(
      `
      SELECT
        b.*,
        s.supplier_name,
        u1.full_name AS ordered_by_name,
        u2.full_name AS received_by_name
      FROM batch b
      JOIN supplier s   ON s.supplier_id = b.supplier_id
      JOIN user u1      ON u1.user_id    = b.ordered_by
      LEFT JOIN user u2 ON u2.user_id    = b.received_by
      WHERE b.batch_id = ?
    `,
      [req.params.id],
    );

    if (batches.length === 0)
      return res.status(404).json({ error: "Batch not found." });

    const [items] = await db.query(
      `
      SELECT
        bi.*,
        m.medicine_name,
        m.form,
        m.unit
      FROM batch_item bi
      JOIN medicine m ON m.medicine_id = bi.medicine_id
      WHERE bi.batch_id = ?
    `,
      [req.params.id],
    );

    res.json({ ...batches[0], items });
  } catch (err) {
    next(err);
  }
});

// POST /api/batches
// Creates a new batch (status = pending) and inserts its items.
// The trg_after_insert_batch_item trigger auto-calculates invoice_amount.
router.post("/", async (req, res, next) => {
  try {
    const {
      supplier_id,
      ordered_by_user_id,
      order_date,
      invoice_no,
      notes,
      items,
    } = req.body;

    validate(supplier_id, "supplier_id is required");
    validate(ordered_by_user_id, "ordered_by (user_id) is required");
    validate(order_date, "order_date is required");

    if (!Array.isArray(items) || items.length === 0) {
      const err = new Error("At least one batch item is required.");
      err.status = 400;
      throw err;
    }

    // Auto-generate batch_no
    const [[{ count }]] = await db.query("SELECT COUNT(*) AS count FROM batch");
    const batch_no = `BCH-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;

    const [batchResult] = await db.query(
      `INSERT INTO batch (batch_no, supplier_id, ordered_by, order_date, invoice_no, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        batch_no,
        supplier_id,
        ordered_by_user_id,
        order_date,
        invoice_no || null,
        notes || null,
      ],
    );

    const batch_id = batchResult.insertId;

    for (const item of items) {
      validate(item.medicine_id, "medicine_id is required in each item");
      validate(item.qty_ordered, "qty_ordered is required in each item");
      validate(item.expiry_date, "expiry_date is required in each item");
      validate(item.unit_cost, "unit_cost is required in each item");

      await db.query(
        `INSERT INTO batch_item
           (batch_id, medicine_id, quantity_ordered, quantity_received, manufacture_date, expiry_date, unit_price)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          batch_id,
          item.medicine_id,
          item.qty_ordered,
          item.qty_ordered, // quantity_received = same as ordered for now
          item.mfg_date || null,
          item.expiry_date,
          item.unit_cost,
        ],
      );
    }

    res.status(201).json({ message: `Batch ${batch_no} created.`, batch_id });
  } catch (err) {
    next(err);
  }
});

// POST /api/batches/:id/receive
// Calls sp_receive_batch — changes status to received and fires the stock ledger trigger
router.post("/:id/receive", async (req, res, next) => {
  try {
    const { received_by, received_date } = req.body;

    validate(received_by, "received_by (user_id) is required");
    validate(received_date, "received_date is required");

    // This calls our stored procedure which updates the batch status.
    // The trg_after_batch_received trigger then inserts stock_ledger rows.
    await db.query("CALL sp_receive_batch(?, ?, ?)", [
      req.params.id,
      received_by,
      received_date,
    ]);

    res.json({ message: "Batch marked as received. Stock ledger updated." });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
