const express  = require("express");
const router   = express.Router();
const db       = require("../config/db");
const validate = require("../middleware/validate");

// GET /api/returns
// Returns all return/damage records with medicine and batch info joined
router.get("/", async (req, res, next) => {
  try {
    const [rows] = await db.query(`
      SELECT
        r.return_id,
        r.return_type,
        r.return_date,
        m.medicine_name,
        b.batch_no,
        r.quantity_returned,
        r.reason,
        r.damage_cause,
        r.resolution,
        r.refund_amount,
        u.full_name AS processed_by
      FROM \`return\` r
      JOIN medicine   m  ON m.medicine_id    = r.medicine_id
      JOIN batch_item bi ON bi.batch_item_id = r.batch_item_id
      JOIN batch      b  ON b.batch_id       = bi.batch_id
      JOIN user       u  ON u.user_id        = r.processed_by
      ORDER BY r.return_id DESC
    `);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/returns/customer
// Calls sp_process_return — handles customer returns (refund or replacement).
// trg_after_return_insert updates stock_ledger with return_in entry.
router.post("/customer", async (req, res, next) => {
  try {
    const {
      sale_item_id,
      quantity_returned,
      reason,
      resolution,
      processed_by,
    } = req.body;

    validate(sale_item_id,      "sale_item_id is required");
    validate(quantity_returned, "quantity_returned is required");
    validate(reason,            "reason is required");
    validate(resolution,        "resolution is required");
    validate(processed_by,      "processed_by (user_id) is required");

    await db.query("CALL sp_process_return(?, ?, ?, ?, ?)", [
      sale_item_id,
      quantity_returned,
      reason,
      resolution,
      processed_by,
    ]);

    res.status(201).json({ message: "Customer return processed. Stock ledger updated." });
  } catch (err) {
    next(err);
  }
});

// POST /api/returns/damage
// Calls sp_report_damage — handles pre-sale damage write-offs.
// trg_before_return_insert checks stock won't go negative.
// trg_after_return_insert writes damage_write_off to stock_ledger.
router.post("/damage", async (req, res, next) => {
  try {
    const {
      batch_item_id,
      quantity_damaged,
      damage_cause,
      resolution,
      processed_by,
    } = req.body;

    validate(batch_item_id,    "batch_item_id is required");
    validate(quantity_damaged, "quantity_damaged is required");
    validate(damage_cause,     "damage_cause is required");
    validate(resolution,       "resolution is required");
    validate(processed_by,     "processed_by (user_id) is required");

    await db.query("CALL sp_report_damage(?, ?, ?, ?, ?)", [
      batch_item_id,
      quantity_damaged,
      damage_cause,
      resolution,
      processed_by,
    ]);

    res.status(201).json({ message: "Damage reported. Stock ledger updated." });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
