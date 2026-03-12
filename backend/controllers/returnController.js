const pool = require("../config/db");

// ============================================================
// POST /api/returns/customer
// Process a customer return — calls sp_process_return
// resolution drives what happens to stock:
//   refund      → stock comes back (return_in) + refund_amount set
//   replacement → stock comes back (return_in)
//   pending     → no stock change yet
//
// Body:
// {
//   sale_item_id:      int    (required)
//   quantity_returned: int    (required)
//   reason:            string (required)
//   resolution:        string (required — refund | replacement | pending)
//   processed_by:      int    (required — user_id)
// }
// ============================================================
const processCustomerReturn = async (req, res) => {
  const { sale_item_id, quantity_returned, reason, resolution, processed_by } =
    req.body;

  if (
    !sale_item_id ||
    !quantity_returned ||
    !reason ||
    !resolution ||
    !processed_by
  )
    return res.status(400).json({
      error:
        "sale_item_id, quantity_returned, reason, resolution, and processed_by are required",
    });

  if (!["refund", "replacement", "pending"].includes(resolution))
    return res.status(400).json({
      error: "resolution must be one of: refund, replacement, pending",
    });

  try {
    // Validate sale_item exists and fetch quantity_sold + sale_status
    const [saleItem] = await pool.query(
      `SELECT si.sale_item_id, si.quantity_sold, si.sale_id, s.sale_status
       FROM sale_item si
       JOIN sale s ON s.sale_id = si.sale_id
       WHERE si.sale_item_id = ?`,
      [sale_item_id],
    );

    if (saleItem.length === 0)
      return res.status(404).json({ error: "Sale item not found" });

    if (saleItem[0].sale_status === "fully_returned")
      return res
        .status(409)
        .json({ error: "This sale has already been fully returned" });

    if (quantity_returned > saleItem[0].quantity_sold)
      return res.status(409).json({
        error: `quantity_returned (${quantity_returned}) cannot exceed quantity_sold (${saleItem[0].quantity_sold})`,
      });

    // Prevent over-returning if already partially returned
    const [existing] = await pool.query(
      `SELECT COALESCE(SUM(quantity_returned), 0) AS already_returned
       FROM \`return\`
       WHERE sale_item_id = ? AND resolution != 'pending'`,
      [sale_item_id],
    );

    const alreadyReturned = existing[0].already_returned || 0;
    const remainingReturnable = saleItem[0].quantity_sold - alreadyReturned;

    if (quantity_returned > remainingReturnable)
      return res.status(409).json({
        error: `Only ${remainingReturnable} unit(s) can still be returned for this item`,
      });

    await pool.query("CALL sp_process_return(?, ?, ?, ?, ?)", [
      sale_item_id,
      quantity_returned,
      reason,
      resolution,
      processed_by,
    ]);

    return res.status(201).json({
      message: "Customer return processed successfully",
      saleId: saleItem[0].sale_id,
    });
  } catch (err) {
    if (err.sqlState === "45000" || err.code === "ER_SIGNAL_EXCEPTION")
      return res.status(409).json({ error: err.message });
    return res.status(500).json({ error: err.message });
  }
};

// ============================================================
// POST /api/returns/damage
// Report damaged/expired medicine — calls sp_report_damage
// resolution drives stock deduction:
//   write_off          → damage_write_off in stock_ledger (stock DOWN)
//   return_to_supplier → return_out in stock_ledger (stock DOWN)
//
// Body:
// {
//   batch_item_id:    int    (required)
//   quantity_damaged: int    (required)
//   damage_cause:     string (required — e.g. "Water leakage")
//   resolution:       string (required — write_off | return_to_supplier)
//   processed_by:     int    (required — user_id)
// }
// ============================================================
const reportDamage = async (req, res) => {
  const {
    batch_item_id,
    quantity_damaged,
    damage_cause,
    resolution,
    processed_by,
  } = req.body;

  if (
    !batch_item_id ||
    !quantity_damaged ||
    !damage_cause ||
    !resolution ||
    !processed_by
  )
    return res.status(400).json({
      error:
        "batch_item_id, quantity_damaged, damage_cause, resolution, and processed_by are required",
    });

  if (!["write_off", "return_to_supplier"].includes(resolution))
    return res.status(400).json({
      error: "resolution must be one of: write_off, return_to_supplier",
    });

  try {
    // Validate batch_item exists
    const [bi] = await pool.query(
      "SELECT batch_item_id FROM batch_item WHERE batch_item_id = ?",
      [batch_item_id],
    );

    if (bi.length === 0)
      return res.status(404).json({ error: "Batch item not found" });

    // Check available stock before calling procedure
    const [stock] = await pool.query(
      `SELECT COALESCE(SUM(quantity_change), 0) AS current_stock
       FROM stock_ledger WHERE batch_item_id = ?`,
      [batch_item_id],
    );

    if (quantity_damaged > stock[0].current_stock)
      return res.status(409).json({
        error: `quantity_damaged (${quantity_damaged}) exceeds available stock (${stock[0].current_stock})`,
      });

    await pool.query("CALL sp_report_damage(?, ?, ?, ?, ?)", [
      batch_item_id,
      quantity_damaged,
      damage_cause,
      resolution,
      processed_by,
    ]);

    return res.status(201).json({
      message: "Damage report submitted successfully. Stock ledger updated.",
    });
  } catch (err) {
    if (err.sqlState === "45000" || err.code === "ER_SIGNAL_EXCEPTION")
      return res.status(409).json({ error: err.message });
    return res.status(500).json({ error: err.message });
  }
};

// ============================================================
// GET /api/returns
// All returns with medicine, batch, sale and user info
// ============================================================
const getAllReturns = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        r.return_id,
        r.return_type,
        r.return_date,
        r.quantity_returned,
        r.reason,
        r.damage_cause,
        r.resolution,
        r.refund_amount,
        m.medicine_name,
        m.brand_name,
        m.strength,
        b.batch_no,
        r.sale_item_id,
        s.sale_id,
        s.customer_name,
        u.full_name AS processed_by_name
      FROM \`return\` r
      JOIN medicine   m  ON m.medicine_id    = r.medicine_id
      JOIN batch_item bi ON bi.batch_item_id = r.batch_item_id
      JOIN batch      b  ON b.batch_id       = bi.batch_id
      LEFT JOIN sale_item si ON si.sale_item_id = r.sale_item_id
      LEFT JOIN sale      s  ON s.sale_id       = si.sale_id
      JOIN user       u  ON u.user_id        = r.processed_by
      ORDER BY r.return_date DESC
    `);

    if (rows.length === 0)
      return res.status(404).json({ error: "No returns found" });

    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ============================================================
// GET /api/returns/:id
// Single return with full details
// ============================================================
const getReturnById = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
        r.return_id,
        r.return_type,
        r.return_date,
        r.quantity_returned,
        r.reason,
        r.damage_cause,
        r.resolution,
        r.refund_amount,
        r.batch_item_id,
        m.medicine_id,
        m.medicine_name,
        m.brand_name,
        m.category,
        m.strength,
        b.batch_no,
        r.sale_item_id,
        s.sale_id,
        s.customer_name,
        s.customer_phone,
        u.user_id   AS processed_by_id,
        u.full_name AS processed_by_name
      FROM \`return\` r
      JOIN medicine   m  ON m.medicine_id    = r.medicine_id
      JOIN batch_item bi ON bi.batch_item_id = r.batch_item_id
      JOIN batch      b  ON b.batch_id       = bi.batch_id
      LEFT JOIN sale_item si ON si.sale_item_id = r.sale_item_id
      LEFT JOIN sale      s  ON s.sale_id       = si.sale_id
      JOIN user       u  ON u.user_id        = r.processed_by
      WHERE r.return_id = ?`,
      [req.params.id],
    );

    if (rows.length === 0)
      return res.status(404).json({ error: "Return not found" });

    return res.json(rows[0]);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ============================================================
// GET /api/returns/filter
// ?return_type=customer_return | damage_report | supplier_return
// ?resolution=refund | replacement | write_off | return_to_supplier | pending
// ?startDate=2025-01-01&endDate=2025-12-31
// ============================================================
const filterReturns = async (req, res) => {
  const { return_type, resolution, startDate, endDate } = req.query;

  try {
    let sql = `
      SELECT
        r.return_id,
        r.return_type,
        r.return_date,
        r.quantity_returned,
        r.reason,
        r.damage_cause,
        r.resolution,
        r.refund_amount,
        m.medicine_name,
        b.batch_no,
        s.customer_name,
        u.full_name AS processed_by_name
      FROM \`return\` r
      JOIN medicine   m  ON m.medicine_id    = r.medicine_id
      JOIN batch_item bi ON bi.batch_item_id = r.batch_item_id
      JOIN batch      b  ON b.batch_id       = bi.batch_id
      LEFT JOIN sale_item si ON si.sale_item_id = r.sale_item_id
      LEFT JOIN sale      s  ON s.sale_id       = si.sale_id
      JOIN user       u  ON u.user_id        = r.processed_by
      WHERE 1=1
    `;
    const params = [];

    if (return_type) {
      sql += ` AND r.return_type = ?`;
      params.push(return_type);
    }
    if (resolution) {
      sql += ` AND r.resolution = ?`;
      params.push(resolution);
    }
    if (startDate && endDate) {
      sql += ` AND DATE(r.return_date) BETWEEN ? AND ?`;
      params.push(startDate, endDate);
    }

    sql += ` ORDER BY r.return_date DESC`;

    const [rows] = await pool.query(sql, params);

    if (rows.length === 0)
      return res
        .status(404)
        .json({ error: "No returns found matching the criteria" });

    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = {
  processCustomerReturn,
  reportDamage,
  getAllReturns,
  getReturnById,
  filterReturns,
};
