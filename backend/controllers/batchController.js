const pool = require("../config/db");

const INT_PATTERN = /^\d+$/;
const DECIMAL_PATTERN = /^\d+(\.\d{1,2})?$/;
const isIntLike = (value) => INT_PATTERN.test(String(value ?? ""));
const isDecimalLike = (value) => DECIMAL_PATTERN.test(String(value ?? ""));

// ============================================================
// POST /api/batches
// Creates a new batch with all its items.
//
// Schema (original):
//   batch:      batch_no, supplier_id, received_by, received_date,
//               invoice_no, invoice_amount (auto by trigger), notes
//   batch_item: batch_id, medicine_id, quantity_received,
//               manufacture_date, expiry_date, unit_price
//
// Triggers fired on batch_item INSERT:
//   trg_before_batch_item_insert        → blocks inactive medicine
//   trg_after_batch_item_insert         → writes 'purchase' to stock_ledger
//   trg_after_insert_batch_item_invoice → auto-updates batch.invoice_amount
//
// FIX: Removed ordered_by, order_date, batch_status, quantity_ordered
//      — these fields do not exist in the schema
// ============================================================
const addBatch = async (req, res) => {
  const {
    batch_no,
    supplier_id,
    received_by, // user_id who is receiving/entering the batch
    received_date, // optional — defaults to CURRENT_DATE in schema
    invoice_no, // optional
    notes, // optional
    items, // array of { medicine_id, quantity_received, manufacture_date, expiry_date, unit_price }
  } = req.body;

  if (
    !batch_no ||
    !supplier_id ||
    !received_by ||
    !items ||
    items.length === 0
  ) {
    return res.status(400).json({
      error:
        "batch_no, supplier_id, received_by, and at least one item are required",
    });
  }

  // Validate each item has required fields
  for (const item of items) {
    if (
      !item.medicine_id ||
      !item.quantity_received ||
      !item.manufacture_date ||
      !item.expiry_date ||
      !item.unit_price
    ) {
      return res.status(400).json({
        error:
          "Each item requires: medicine_id, quantity_received, manufacture_date, expiry_date, unit_price",
      });
    }

    if (!isIntLike(item.quantity_received) || parseInt(item.quantity_received, 10) <= 0) {
      return res.status(400).json({
        error: "quantity_received must be a positive whole number",
      });
    }

    if (!isDecimalLike(item.unit_price) || parseFloat(item.unit_price) <= 0) {
      return res.status(400).json({
        error: "unit_price must be a positive number with up to 2 decimals",
      });
    }

    const today = new Date();
    const todayDateOnly = new Date(today.toISOString().split("T")[0]);
    const manufactureDate = new Date(item.manufacture_date);
    const expiryDate = new Date(item.expiry_date);

    if (Number.isNaN(manufactureDate.valueOf()) || Number.isNaN(expiryDate.valueOf())) {
      return res.status(400).json({
        error: "Invalid manufacture_date or expiry_date format",
      });
    }

    if (manufactureDate > todayDateOnly) {
      return res.status(400).json({
        error: "manufacture_date cannot be in the future",
      });
    }

    if (expiryDate <= manufactureDate) {
      return res.status(400).json({
        error: "expiry_date must be after manufacture_date",
      });
    }

    if (expiryDate <= todayDateOnly) {
      return res.status(400).json({
        error: "expiry_date must be in the future",
      });
    }
  }

  try {
    // FIX: Check supplier is active before creating batch
    const [supplier] = await pool.query(
      "SELECT supplier_id, is_active FROM supplier WHERE supplier_id = ?",
      [supplier_id],
    );

    if (supplier.length === 0) {
      return res.status(404).json({ error: "Supplier not found" });
    }

    if (supplier[0].is_active === 0) {
      return res.status(409).json({
        error: "Cannot create batch: supplier is inactive (deactivated)",
      });
    }

    // Insert batch header
    // invoice_amount starts NULL — trigger auto-calculates per batch_item insert
    const [batchResult] = await pool.query(
      `INSERT INTO batch (batch_no, supplier_id, received_by, received_date, invoice_no, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        batch_no,
        supplier_id,
        received_by,
        received_date || null,
        invoice_no || null,
        notes || null,
      ],
    );

    const newBatchId = batchResult.insertId;

    // Insert batch_items sequentially (not parallel) so that if one
    // fails (e.g. inactive medicine blocked by trigger), we get a
    // clear error rather than partial inserts from Promise.all
    for (const item of items) {
      await pool.query(
        `INSERT INTO batch_item
           (batch_id, medicine_id, quantity_received, manufacture_date, expiry_date, unit_price)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          newBatchId,
          item.medicine_id,
          item.quantity_received,
          item.manufacture_date,
          item.expiry_date,
          item.unit_price,
        ],
      );
      // trg_before_batch_item_insert fires → blocks if medicine is inactive
      // trg_after_batch_item_insert fires  → writes 'purchase' to stock_ledger
      // trg_after_insert_batch_item_invoice fires → adds to batch.invoice_amount
    }

    return res.status(201).json({
      success: true,
      message: "Batch created successfully. Stock ledger updated.",
      batchId: newBatchId,
    });
  } catch (err) {
    // Catch trigger SIGNAL errors (inactive medicine, etc.)
    if (err.sqlState === "45000") {
      return res.status(409).json({ error: err.message });
    }
    return res.status(500).json({ error: err.message });
  }
};

// ============================================================
// GET /api/batches
// Returns all batches with their nested items
// Joins batch → batch_item → medicine → supplier → user
// FIX: Removed vw_batch_detail / vw_batch_master references
//      — these views do not exist in the schema
//      Using direct joins instead
// ============================================================
const getAllBatches = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        b.batch_id,
        b.batch_no,
        b.received_date,
        b.invoice_no,
        b.invoice_amount,
        b.notes,
        s.supplier_id,
        s.supplier_name,
        s.phone         AS supplier_phone,
        s.email         AS supplier_email,
        s.is_active     AS supplier_active,
        u.user_id       AS received_by_id,
        u.full_name     AS received_by_name,
        bi.batch_item_id,
        m.medicine_id,
        m.medicine_name,
        m.brand_name,
        c.name          AS category,
        m.strength,
        m.is_active     AS medicine_active,
        bi.quantity_received,
        bi.manufacture_date,
        bi.expiry_date,
        bi.unit_price
      FROM batch b
      JOIN supplier   s  ON s.supplier_id    = b.supplier_id
      JOIN user       u  ON u.user_id        = b.received_by
      LEFT JOIN batch_item bi ON bi.batch_id = b.batch_id
      LEFT JOIN medicine   m  ON m.medicine_id = bi.medicine_id
      LEFT JOIN category   c  ON c.category_id = m.category_id
      ORDER BY b.batch_id DESC
    `);

    if (rows.length === 0) {
      return res.status(404).json({ error: "No batches found" });
    }

    // Group flat rows into nested batch → items structure
    const batches = rows.reduce((acc, row) => {
      let batch = acc.find((b) => b.batch_id === row.batch_id);

      if (!batch) {
        batch = {
          batch_id: row.batch_id,
          batch_no: row.batch_no,
          received_date: row.received_date,
          invoice_no: row.invoice_no,
          invoice_amount: row.invoice_amount,
          notes: row.notes,
          supplier_id: row.supplier_id,
          supplier_name: row.supplier_name,
          supplier_phone: row.supplier_phone,
          supplier_email: row.supplier_email,
          supplier_active: row.supplier_active,
          received_by_id: row.received_by_id,
          received_by_name: row.received_by_name,
          items: [],
        };
        acc.push(batch);
      }

      if (row.batch_item_id) {
        batch.items.push({
          batch_item_id: row.batch_item_id,
          medicine_id: row.medicine_id,
          medicine_name: row.medicine_name,
          brand_name: row.brand_name,
          category: row.category,
          strength: row.strength,
          medicine_active: row.medicine_active,
          quantity_received: row.quantity_received,
          manufacture_date: row.manufacture_date,
          expiry_date: row.expiry_date,
          unit_price: row.unit_price,
        });
      }

      return acc;
    }, []);

    return res.status(200).json(batches);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ============================================================
// GET /api/batches/:id
// Returns full detail of one batch with nested items
// ============================================================
const getBatchDetails = async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await pool.query(
      `SELECT
        b.batch_id,
        b.batch_no,
        b.received_date,
        b.invoice_no,
        b.invoice_amount,
        b.notes,
        s.supplier_id,
        s.supplier_name,
        s.phone         AS supplier_phone,
        s.email         AS supplier_email,
        s.is_active     AS supplier_active,
        u.user_id       AS received_by_id,
        u.full_name     AS received_by_name,
        bi.batch_item_id,
        m.medicine_id,
        m.medicine_name,
        m.brand_name,
        c.name          AS category,
        m.strength,
        m.is_active     AS medicine_active,
        bi.quantity_received,
        bi.manufacture_date,
        bi.expiry_date,
        bi.unit_price
      FROM batch b
      JOIN supplier   s  ON s.supplier_id    = b.supplier_id
      JOIN user       u  ON u.user_id        = b.received_by
      LEFT JOIN batch_item bi ON bi.batch_id = b.batch_id
      LEFT JOIN medicine   m  ON m.medicine_id = bi.medicine_id
      LEFT JOIN category   c  ON c.category_id = m.category_id
      WHERE b.batch_id = ?`,
      [id],
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Batch not found" });
    }

    const batchDetail = {
      batch_id: rows[0].batch_id,
      batch_no: rows[0].batch_no,
      received_date: rows[0].received_date,
      invoice_no: rows[0].invoice_no,
      invoice_amount: rows[0].invoice_amount,
      notes: rows[0].notes,
      supplier_id: rows[0].supplier_id,
      supplier_name: rows[0].supplier_name,
      supplier_phone: rows[0].supplier_phone,
      supplier_email: rows[0].supplier_email,
      supplier_active: rows[0].supplier_active,
      received_by_id: rows[0].received_by_id,
      received_by_name: rows[0].received_by_name,
      items: rows[0].batch_item_id
        ? rows.map((row) => ({
            batch_item_id: row.batch_item_id,
            medicine_id: row.medicine_id,
            medicine_name: row.medicine_name,
            brand_name: row.brand_name,
            category: row.category,
            strength: row.strength,
            medicine_active: row.medicine_active,
            quantity_received: row.quantity_received,
            manufacture_date: row.manufacture_date,
            expiry_date: row.expiry_date,
            unit_price: row.unit_price,
          }))
        : [],
    };

    return res.status(200).json(batchDetail);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ============================================================
// GET /api/batches/filter
// Filter by batch_no, supplier_id, received_date range
// FIX: Removed batch_status, order_date — not in schema
//      Uses direct query instead of vw_batch_master
// ?q=BATCH&supplier_id=1&startDate=2025-01-01&endDate=2025-12-31
// ============================================================
const getFilteredBatches = async (req, res) => {
  const { q, supplier_id, startDate, endDate } = req.query;

  try {
    let sql = `
      SELECT
        b.batch_id,
        b.batch_no,
        b.received_date,
        b.invoice_no,
        b.invoice_amount,
        b.notes,
        s.supplier_name,
        s.is_active AS supplier_active,
        u.full_name AS received_by_name
      FROM batch b
      JOIN supplier s ON s.supplier_id = b.supplier_id
      JOIN user     u ON u.user_id     = b.received_by
      WHERE 1=1
    `;
    const params = [];

    if (q) {
      sql += ` AND b.batch_no LIKE ?`;
      params.push(`%${q}%`);
    }

    if (supplier_id) {
      sql += ` AND b.supplier_id = ?`;
      params.push(supplier_id);
    }

    if (startDate && endDate) {
      sql += ` AND b.received_date BETWEEN ? AND ?`;
      params.push(startDate, endDate);
    }

    sql += ` ORDER BY b.received_date DESC`;

    const [rows] = await pool.query(sql, params);

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ error: "No batches found matching the criteria" });
    }

    return res.status(200).json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = {
  addBatch,
  getAllBatches,
  getBatchDetails,
  getFilteredBatches,
};
