const pool = require("../config/db");

const INT_PATTERN = /^\d+$/;
const isIntLike = (value) => INT_PATTERN.test(String(value ?? ""));

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
  const {
    sale_item_id,
    sale_item_ids,
    quantity_returned,
    reason,
    resolution,
    processed_by,
  } = req.body;

  const ids = Array.isArray(sale_item_ids) && sale_item_ids.length > 0
    ? sale_item_ids.map((x) => parseInt(x)).filter(Boolean)
    : (sale_item_id ? [parseInt(sale_item_id)] : []);

  if (!ids.length || !quantity_returned || !reason || !resolution || !processed_by)
    return res.status(400).json({
      error:
        "sale_item_id (or sale_item_ids), quantity_returned, reason, resolution, and processed_by are required",
    });

  if (!isIntLike(quantity_returned)) {
    return res.status(400).json({ error: "quantity_returned must be a whole number" });
  }

  if (!["refund", "replacement", "pending"].includes(resolution))
    return res.status(400).json({
      error: "resolution must be one of: refund, replacement, pending",
    });

  try {
    // Fetch all sale items at once (also includes already returned amounts)
    const placeholders = ids.map(() => "?").join(",");
    const [rows] = await pool.query(
      `SELECT
         si.sale_item_id,
         si.quantity_sold,
         si.sale_id,
         s.sale_status,
         COALESCE(SUM(r.quantity_returned), 0) AS already_returned
       FROM sale_item si
       JOIN sale s ON s.sale_id = si.sale_id
       LEFT JOIN \`return\` r ON r.sale_item_id = si.sale_item_id
       WHERE si.sale_item_id IN (${placeholders})
       GROUP BY si.sale_item_id, si.quantity_sold, si.sale_id, s.sale_status
       ORDER BY si.sale_item_id ASC`,
      ids,
    );

    if (rows.length !== ids.length) {
      return res.status(404).json({ error: "One or more sale items not found" });
    }

    const saleId = rows[0].sale_id;
    if (!rows.every((r) => r.sale_id === saleId)) {
      return res.status(400).json({ error: "sale_item_ids must belong to the same sale" });
    }

    if (rows[0].sale_status === "fully_returned") {
      return res.status(409).json({ error: "This sale has already been fully returned" });
    }

    let remainingToAllocate = parseInt(quantity_returned);
    if (!remainingToAllocate || remainingToAllocate <= 0) {
      return res.status(400).json({ error: "quantity_returned must be > 0" });
    }

    for (const r of rows) {
      const remainingReturnable = (r.quantity_sold || 0) - (r.already_returned || 0);
      if (remainingReturnable <= 0) continue;
      const take = Math.min(remainingReturnable, remainingToAllocate);
      if (take > 0) {
        await pool.query("CALL sp_process_return(?, ?, ?, ?, ?)", [
          r.sale_item_id,
          take,
          reason,
          resolution,
          processed_by,
        ]);
        remainingToAllocate -= take;
      }
      if (remainingToAllocate <= 0) break;
    }

    if (remainingToAllocate > 0) {
      const totalRemaining = rows.reduce(
        (sum, r) => sum + Math.max((r.quantity_sold || 0) - (r.already_returned || 0), 0),
        0,
      );
      return res.status(409).json({
        error: `Only ${totalRemaining} unit(s) can still be returned for this item`,
      });
    }

    return res.status(201).json({
      message: "Customer return processed successfully",
      saleId,
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
    batch_item_ids,
    quantity_damaged,
    damage_cause,
    resolution,
    processed_by,
  } = req.body;

  const ids = Array.isArray(batch_item_ids) && batch_item_ids.length > 0
    ? batch_item_ids.map((x) => parseInt(x)).filter(Boolean)
    : (batch_item_id ? [parseInt(batch_item_id)] : []);

  if (
    !ids.length ||
    !quantity_damaged ||
    !damage_cause ||
    !resolution ||
    !processed_by
  )
    return res.status(400).json({
      error:
        "batch_item_id (or batch_item_ids), quantity_damaged, damage_cause, resolution, and processed_by are required",
    });

  if (!isIntLike(quantity_damaged)) {
    return res.status(400).json({ error: "quantity_damaged must be a whole number" });
  }

  if (!["write_off", "return_to_supplier"].includes(resolution))
    return res.status(400).json({
      error: "resolution must be one of: write_off, return_to_supplier",
    });

  try {
    const placeholders = ids.map(() => "?").join(",");
    const [batchItems] = await pool.query(
      `SELECT batch_item_id, medicine_id, expiry_date
       FROM batch_item
       WHERE batch_item_id IN (${placeholders})
       ORDER BY expiry_date ASC, batch_item_id ASC`,
      ids,
    );

    if (batchItems.length !== ids.length) {
      return res.status(404).json({ error: "One or more batch items not found" });
    }

    const medicineId = batchItems[0].medicine_id;
    if (!batchItems.every((row) => row.medicine_id === medicineId)) {
      return res.status(400).json({
        error: "batch_item_ids must belong to the same medicine",
      });
    }

    const [stockRows] = await pool.query(
      `SELECT batch_item_id, COALESCE(SUM(quantity_change), 0) AS current_stock
       FROM stock_ledger
       WHERE batch_item_id IN (${placeholders})
       GROUP BY batch_item_id`,
      ids,
    );
    const stockMap = new Map(stockRows.map((row) => [row.batch_item_id, row.current_stock]));
    const withStock = batchItems.map((row) => ({
      ...row,
      current_stock: stockMap.get(row.batch_item_id) || 0,
    }));

    const totalStock = withStock.reduce((sum, row) => sum + (row.current_stock || 0), 0);
    if (quantity_damaged > totalStock) {
      return res.status(409).json({
        error: `quantity_damaged (${quantity_damaged}) exceeds available stock (${totalStock})`,
      });
    }

    let remaining = parseInt(quantity_damaged);
    for (const row of withStock) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, row.current_stock || 0);
      if (take <= 0) continue;
      await pool.query("CALL sp_report_damage(?, ?, ?, ?, ?)", [
        row.batch_item_id,
        take,
        damage_cause,
        resolution,
        processed_by,
      ]);
      remaining -= take;
    }

    if (remaining > 0) {
      return res.status(409).json({
        error: `Only ${totalStock} unit(s) can be written off for this selection`,
      });
    }

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
        c.name AS category,
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
      JOIN category   c  ON c.category_id    = m.category_id
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
