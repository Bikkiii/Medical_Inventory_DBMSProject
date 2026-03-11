const express = require("express");
const router  = express.Router();
const db      = require("../config/db");

// GET /api/stock
// Returns all rows from vw_current_stock.
// Optional query param: ?medicine=Paracetamol (partial match)
router.get("/", async (req, res, next) => {
  try {
    let query  = "SELECT * FROM vw_current_stock";
    const params = [];

    if (req.query.medicine) {
      query += " WHERE medicine_name LIKE ?";
      params.push(`%${req.query.medicine}%`);
    }

    query += " ORDER BY medicine_name, expiry_date";

    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/stock/expiry-alerts
// Returns vw_expiry_alert — items expiring within 90 days
router.get("/expiry-alerts", async (req, res, next) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM vw_expiry_alert ORDER BY expiry_date ASC"
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/stock/low-stock
// Returns vw_low_stock — items at or below reorder level
router.get("/low-stock", async (req, res, next) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM vw_low_stock ORDER BY total_stock ASC"
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/stock/ledger
// Full stock_ledger with joins — the audit trail
// Optional filters: ?medicine_id=1 or ?type=sale
router.get("/ledger", async (req, res, next) => {
  try {
    let query = `
      SELECT
        sl.ledger_id,
        m.medicine_name,
        b.batch_no,
        sl.transaction_type,
        sl.quantity_change,
        sl.balance_after,
        sl.reference_id,
        u.full_name AS transacted_by,
        sl.transacted_at
      FROM stock_ledger sl
      JOIN medicine   m  ON m.medicine_id    = sl.medicine_id
      JOIN batch_item bi ON bi.batch_item_id = sl.batch_item_id
      JOIN batch      b  ON b.batch_id       = bi.batch_id
      JOIN user       u  ON u.user_id        = sl.transacted_by
      WHERE 1=1
    `;

    const params = [];

    if (req.query.medicine_id) {
      query += " AND sl.medicine_id = ?";
      params.push(req.query.medicine_id);
    }

    if (req.query.type) {
      query += " AND sl.transaction_type = ?";
      params.push(req.query.type);
    }

    query += " ORDER BY sl.ledger_id DESC";

    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
