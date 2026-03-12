const pool = require("../config/db");

// ============================================================
// GET /api/inventory/current-stock
// Queries vw_current_stock
// Only shows received batches (WHERE b.batch_status = 'received')
// Returns per-batch_item stock with expiry_status + stock_status
//
// New fields vs old schema:
//   medicine: generic_name, form, unit added
//   batch: batch_id included
// ============================================================
const getAllStocks = async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM vw_current_stock");

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: "No stock data found" });
    }

    return res.json(rows);
  } catch (err) {
    console.error("Database Error:", err.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// ============================================================
// GET /api/inventory/expiry-alerts
// Queries vw_expiry_alert
// Only received batches, only stock > 0, expiry within 90 days
// Ordered by expiry_date ASC (most urgent first)
//
// alert_level values:
//   'EXPIRED' | 'EXPIRING IN 30 DAYS' |
//   'EXPIRING IN 60 DAYS' | 'EXPIRING IN 90 DAYS'
// ============================================================
const getExpiryAlerts = async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM vw_expiry_alert");

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: "No expiry alerts found" });
    }

    return res.json(rows);
  } catch (err) {
    console.error("Database Error:", err.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// ============================================================
// GET /api/inventory/low-stock
// Queries vw_low_stock
// Aggregates stock across ALL batches per medicine
// Only shows medicines at or below reorder_level
//
// New fields vs old schema:
//   medicine: generic_name, form, unit added
//
// stock_alert values: 'OUT OF STOCK' | 'LOW STOCK'
// ============================================================
const getLowStock = async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM vw_low_stock");

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: "No low stock alerts found" });
    }

    return res.json(rows);
  } catch (err) {
    console.error("Database Error:", err.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = { getAllStocks, getExpiryAlerts, getLowStock };
