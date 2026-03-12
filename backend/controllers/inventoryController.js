const pool = require("../config/db");

// ============================================================
// GET /api/inventory/current-stock
// Queries vw_current_stock
// Returns per-batch_item stock with expiry_status + stock_status
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
// Fields include category, reorder_level, total_stock, shortage_quantity, stock_alert
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

// ============================================================
// GET /api/inventory/ledger
// Full stock ledger with medicine, batch and user info
// ============================================================
const getLedger = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        sl.ledger_id,
        sl.medicine_id,
        m.medicine_name,
        m.brand_name,
        m.strength,
        sl.batch_item_id,
        b.batch_no,
        sl.transaction_type,
        sl.quantity_change,
        sl.balance_after,
        sl.reference_id,
        sl.transacted_by,
        u.full_name AS transacted_by_name,
        sl.transacted_at,
        r.return_type,
        r.resolution
      FROM stock_ledger sl
      JOIN medicine   m  ON m.medicine_id    = sl.medicine_id
      JOIN batch_item bi ON bi.batch_item_id = sl.batch_item_id
      JOIN batch      b  ON b.batch_id       = bi.batch_id
      JOIN user       u  ON u.user_id        = sl.transacted_by
      LEFT JOIN \`return\` r
        ON r.return_id = sl.reference_id
       AND sl.transaction_type IN ('return_in', 'return_out', 'damage_write_off')
      ORDER BY sl.transacted_at DESC, sl.ledger_id DESC
    `);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: "No ledger entries found" });
    }

    return res.json(rows);
  } catch (err) {
    console.error("Database Error:", err.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = { getAllStocks, getExpiryAlerts, getLowStock, getLedger };
