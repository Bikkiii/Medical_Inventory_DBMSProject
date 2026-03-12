const pool = require("../config/db");

// ============================================================
// GET /api/medicines
// FIX: Returns only ACTIVE medicines (is_active = TRUE)
// Uses vw_active_medicines view — safe for sale/batch dropdowns
// ============================================================
const getAllMedicines = async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM vw_active_medicines ORDER BY medicine_name ASC",
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "No medicines found" });
    }

    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ============================================================
// GET /api/medicines/all
// Returns ALL medicines including inactive — admin view only
// ============================================================
const getAllMedicinesAdmin = async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM medicine ORDER BY medicine_name ASC",
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "No medicines found" });
    }

    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ============================================================
// POST /api/medicines
// Schema columns: medicine_name, brand_name, category,
//                 strength, reorder_level
// FIX: Removed generic_name, form, unit — not in schema
// Required: medicine_name, category
// Optional: brand_name, strength, reorder_level
//
// category ENUM: 'antibiotic'|'analgesic'|'antiviral'|
//                'vitamin'|'vaccine'|'topical'|'other'
// ============================================================
const addMedicine = async (req, res) => {
  try {
    const {
      medicine_name,
      brand_name, // optional (NULL allowed)
      category, // ENUM — required
      strength, // optional (NULL allowed)
      reorder_level, // optional — defaults to 0
    } = req.body;

    if (!medicine_name || !category) {
      return res.status(400).json({
        error: "medicine_name and category are required",
      });
    }

    // Duplicate check — same name + strength combination
    const [existing] = await pool.query(
      "SELECT medicine_id FROM medicine WHERE medicine_name = ? AND strength = ?",
      [medicine_name, strength || null],
    );

    if (existing.length > 0) {
      return res.status(409).json({
        error: "Medicine with this name and strength already exists",
      });
    }

    const [result] = await pool.query(
      `INSERT INTO medicine
         (medicine_name, brand_name, category, strength, reorder_level)
       VALUES (?, ?, ?, ?, ?)`,
      [
        medicine_name,
        brand_name || null,
        category,
        strength || null,
        reorder_level || 0,
      ],
    );

    return res.status(201).json({
      message: "Medicine created successfully",
      medicineId: result.insertId,
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

// ============================================================
// GET /api/medicines/:id
// Returns medicine by ID regardless of is_active status
// ============================================================
const getMedicineById = async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM medicine WHERE medicine_id = ?",
      [req.params.id],
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Medicine not found" });
    }

    return res.json(rows[0]);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ============================================================
// PUT /api/medicines/:id
// Updates any field — uses COALESCE to keep existing values
// FIX: Removed generic_name, form, unit — not in schema
// Does NOT touch is_active (use PATCH /deactivate for that)
// ============================================================
const updateMedicine = async (req, res) => {
  try {
    const { id } = req.params;
    const { medicine_name, brand_name, category, strength, reorder_level } =
      req.body;

    const [existing] = await pool.query(
      "SELECT medicine_id FROM medicine WHERE medicine_id = ?",
      [id],
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: "Medicine not found" });
    }

    await pool.query(
      `UPDATE medicine SET
         medicine_name = COALESCE(?, medicine_name),
         brand_name    = COALESCE(?, brand_name),
         category      = COALESCE(?, category),
         strength      = COALESCE(?, strength),
         reorder_level = COALESCE(?, reorder_level)
       WHERE medicine_id = ?`,
      [
        medicine_name || null,
        brand_name || null,
        category || null,
        strength || null,
        reorder_level ?? null,
        id,
      ],
    );

    return res.json({ message: "Medicine updated successfully" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ============================================================
// PATCH /api/medicines/:id/deactivate
// FIX: Soft delete — calls sp_deactivate_medicine
// Sets is_active = FALSE instead of hard deleting
// Discontinued medicine is hidden from sale dropdowns
// but all historical sale/return/ledger records remain intact
// sp_process_sale and trg_before_sale_item_insert both block
// any future sales of this medicine automatically
// ============================================================
const deactivateMedicine = async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await pool.query(
      "SELECT medicine_id, is_active FROM medicine WHERE medicine_id = ?",
      [id],
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: "Medicine not found" });
    }

    if (existing[0].is_active === 0) {
      return res.status(409).json({ error: "Medicine is already inactive" });
    }

    // sp_deactivate_medicine sets is_active = FALSE
    await pool.query("CALL sp_deactivate_medicine(?)", [id]);

    return res.json({
      message:
        "Medicine deactivated successfully. Historical records are preserved.",
    });
  } catch (err) {
    if (err.sqlState === "45000") {
      return res.status(409).json({ error: err.message });
    }
    return res.status(500).json({ error: err.message });
  }
};

// ============================================================
// PATCH /api/medicines/:id/reactivate
// Re-activates a previously discontinued medicine
// ============================================================
const reactivateMedicine = async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await pool.query(
      "SELECT medicine_id, is_active FROM medicine WHERE medicine_id = ?",
      [id],
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: "Medicine not found" });
    }

    if (existing[0].is_active === 1) {
      return res.status(409).json({ error: "Medicine is already active" });
    }

    await pool.query(
      "UPDATE medicine SET is_active = TRUE WHERE medicine_id = ?",
      [id],
    );

    return res.json({ message: "Medicine reactivated successfully" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ============================================================
// GET /api/medicines/filter
// Flexible multi-filter — all params optional, combinable
//
// ?q=amox               → partial medicine_name match
// ?is_active=true       → active medicines only
// ?is_active=false      → inactive (discontinued) medicines only
//                          (omit is_active to get ALL)
// ?category=antibiotic  → filter by category ENUM
// ?brand=amoxil         → partial brand_name match
//
// Examples:
//   /filter?is_active=false                       → all discontinued
//   /filter?category=antibiotic&is_active=true    → active antibiotics
//   /filter?q=para&is_active=false                → discontinued + name
//   /filter?category=analgesic&is_active=false    → discontinued analgesics
//   /filter                                       → all medicines
// ============================================================
const filterMedicines = async (req, res) => {
  try {
    const { q, is_active, category, brand } = req.query;

    let sql = `SELECT * FROM medicine WHERE 1=1`;
    const params = [];

    // Partial medicine name search
    if (q) {
      sql += ` AND medicine_name LIKE ?`;
      params.push(`%${q}%`);
    }

    // is_active filter — true, false, or omit for all
    if (is_active === "true") {
      sql += ` AND is_active = TRUE`;
    } else if (is_active === "false") {
      sql += ` AND is_active = FALSE`;
    }

    // Exact category filter (ENUM)
    if (category) {
      sql += ` AND category = ?`;
      params.push(category);
    }

    // Partial brand name search
    if (brand) {
      sql += ` AND brand_name LIKE ?`;
      params.push(`%${brand}%`);
    }

    sql += ` ORDER BY medicine_name ASC`;

    const [rows] = await pool.query(sql, params);

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ error: "No medicines found matching the criteria" });
    }

    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getAllMedicines,
  getAllMedicinesAdmin,
  getMedicineById,
  addMedicine,
  updateMedicine,
  deactivateMedicine,
  reactivateMedicine,
  filterMedicines,
};
