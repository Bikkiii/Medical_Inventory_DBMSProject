const pool = require("../config/db");

// ============================================================
// GET /api/suppliers
// Returns all ACTIVE suppliers only (is_active = TRUE)
// Frontend dropdown for new batch creation should use this
// ============================================================
const getAllSuppliers = async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM supplier WHERE is_active = TRUE ORDER BY supplier_name ASC",
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "No suppliers found" });
    }

    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ============================================================
// GET /api/suppliers/all
// Returns ALL suppliers including inactive ones
// Used for admin view / history pages
// ============================================================
const getAllSuppliersAdmin = async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM supplier ORDER BY supplier_name ASC",
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "No suppliers found" });
    }

    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ============================================================
// GET /api/suppliers/:id
// Returns a single supplier by ID (active or inactive)
// ============================================================
const getSupplierById = async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM supplier WHERE supplier_id = ?",
      [req.params.id],
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Supplier not found" });
    }

    return res.json(rows[0]);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ============================================================
// POST /api/suppliers
// Schema: supplier_name (required), phone (required),
//         email (optional), address (optional)
// is_active defaults to TRUE in schema — not needed in INSERT
// ============================================================
const addSupplier = async (req, res) => {
  try {
    const { supplier_name, phone, email, address } = req.body;

    if (!supplier_name || !phone) {
      return res
        .status(400)
        .json({ error: "supplier_name and phone are required" });
    }

    const [result] = await pool.query(
      `INSERT INTO supplier (supplier_name, phone, email, address)
       VALUES (?, ?, ?, ?)`,
      [supplier_name, phone, email || null, address || null],
    );

    return res.status(201).json({
      message: "Supplier added successfully",
      supplierId: result.insertId,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ============================================================
// PUT /api/suppliers/:id
// Updates supplier details — all fields optional
// Does NOT touch is_active (use PATCH /deactivate for that)
// ============================================================
const updateSupplier = async (req, res) => {
  try {
    const { supplier_name, phone, email, address } = req.body;
    const { id } = req.params;

    const [existing] = await pool.query(
      "SELECT supplier_id FROM supplier WHERE supplier_id = ?",
      [id],
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: "Supplier not found" });
    }

    await pool.query(
      `UPDATE supplier
       SET supplier_name = COALESCE(?, supplier_name),
           phone         = COALESCE(?, phone),
           email         = COALESCE(?, email),
           address       = COALESCE(?, address)
       WHERE supplier_id = ?`,
      [
        supplier_name || null,
        phone || null,
        email || null,
        address || null,
        id,
      ],
    );

    return res.json({ message: "Supplier updated successfully" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ============================================================
// PATCH /api/suppliers/:id/deactivate
// FIX: Soft delete — calls sp_deactivate_supplier
// Sets is_active = FALSE instead of hard deleting
// All historical batch/return records remain intact and traceable
// A supplier with batches CAN be deactivated (unlike hard delete)
// ============================================================
const deactivateSupplier = async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await pool.query(
      "SELECT supplier_id, is_active FROM supplier WHERE supplier_id = ?",
      [id],
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: "Supplier not found" });
    }

    if (existing[0].is_active === 0) {
      return res.status(409).json({ error: "Supplier is already inactive" });
    }

    // sp_deactivate_supplier sets is_active = FALSE
    await pool.query("CALL sp_deactivate_supplier(?)", [id]);

    return res.json({
      message:
        "Supplier deactivated successfully. Historical records are preserved.",
    });
  } catch (err) {
    if (err.sqlState === "45000") {
      return res.status(409).json({ error: err.message });
    }
    return res.status(500).json({ error: err.message });
  }
};

// ============================================================
// PATCH /api/suppliers/:id/reactivate
// Re-activates a previously deactivated supplier
// ============================================================
const reactivateSupplier = async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await pool.query(
      "SELECT supplier_id, is_active FROM supplier WHERE supplier_id = ?",
      [id],
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: "Supplier not found" });
    }

    if (existing[0].is_active === 1) {
      return res.status(409).json({ error: "Supplier is already active" });
    }

    await pool.query(
      "UPDATE supplier SET is_active = TRUE WHERE supplier_id = ?",
      [id],
    );

    return res.json({ message: "Supplier reactivated successfully" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ============================================================
// GET /api/suppliers/filter
// Flexible multi-filter — all params optional, combinable
//
// ?q=medSupply          → partial name match
// ?is_active=true       → active suppliers only
// ?is_active=false      → inactive suppliers only
//                          (omit is_active to get ALL)
// ?phone=98001          → partial phone match
//
// Examples:
//   /filter?is_active=false                → all inactive
//   /filter?q=med&is_active=true           → active + name match
//   /filter?q=global&is_active=false       → inactive + name match
//   /filter?phone=9800&is_active=false     → inactive + phone match
//   /filter                                → all suppliers
// ============================================================
const filterSuppliers = async (req, res) => {
  try {
    const { q, is_active, phone } = req.query;

    let sql = `SELECT * FROM supplier WHERE 1=1`;
    const params = [];

    // Partial name search
    if (q) {
      sql += ` AND supplier_name LIKE ?`;
      params.push(`%${q}%`);
    }

    // is_active filter — true, false, or omit for all
    if (is_active === "true") {
      sql += ` AND is_active = TRUE`;
    } else if (is_active === "false") {
      sql += ` AND is_active = FALSE`;
    }
    // if is_active is omitted → no filter → returns both active + inactive

    // Partial phone search
    if (phone) {
      sql += ` AND phone LIKE ?`;
      params.push(`%${phone}%`);
    }

    sql += ` ORDER BY supplier_name ASC`;

    const [rows] = await pool.query(sql, params);

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ error: "No suppliers found matching the criteria" });
    }

    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getAllSuppliers,
  getAllSuppliersAdmin,
  getSupplierById,
  addSupplier,
  updateSupplier,
  deactivateSupplier,
  reactivateSupplier,
  filterSuppliers,
};
