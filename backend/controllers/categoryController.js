const pool = require("../config/db");

// ============================================================
// GET /api/categories
// Returns active categories only
// ============================================================
const getAllCategories = async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT category_id, name, description FROM category WHERE is_active = TRUE ORDER BY name ASC",
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "No categories found" });
    }

    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ============================================================
// GET /api/categories/all
// Returns all categories (admin)
// ============================================================
const getAllCategoriesAdmin = async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT category_id, name, description, is_active FROM category ORDER BY name ASC",
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "No categories found" });
    }

    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ============================================================
// POST /api/categories
// Body: { name, description? }
// ============================================================
const addCategory = async (req, res) => {
  try {
    const name = (req.body?.name || "").trim();
    const description = req.body?.description || null;

    if (!name) {
      return res.status(400).json({ error: "name is required" });
    }

    const [existing] = await pool.query(
      "SELECT category_id FROM category WHERE LOWER(name) = LOWER(?)",
      [name],
    );

    if (existing.length > 0) {
      return res.status(409).json({ error: "Category already exists" });
    }

    const [result] = await pool.query(
      "INSERT INTO category (name, description) VALUES (?, ?)",
      [name, description],
    );

    return res.status(201).json({
      message: "Category created successfully",
      categoryId: result.insertId,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ============================================================
// PUT /api/categories/:id
// Body: { name?, description? }
// ============================================================
const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const name = req.body?.name ? String(req.body.name).trim() : null;
    const description =
      req.body?.description === undefined ? null : req.body.description;

    const [existing] = await pool.query(
      "SELECT category_id FROM category WHERE category_id = ?",
      [id],
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: "Category not found" });
    }

    if (name) {
      const [dup] = await pool.query(
        "SELECT category_id FROM category WHERE LOWER(name) = LOWER(?) AND category_id <> ?",
        [name, id],
      );
      if (dup.length > 0) {
        return res.status(409).json({ error: "Category name already exists" });
      }
    }

    await pool.query(
      `UPDATE category SET
         name = COALESCE(?, name),
         description = COALESCE(?, description)
       WHERE category_id = ?`,
      [name, description, id],
    );

    return res.json({ message: "Category updated successfully" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ============================================================
// PATCH /api/categories/:id/deactivate
// ============================================================
const deactivateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const [existing] = await pool.query(
      "SELECT category_id, is_active FROM category WHERE category_id = ?",
      [id],
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: "Category not found" });
    }
    if (existing[0].is_active === 0) {
      return res.status(409).json({ error: "Category is already inactive" });
    }

    await pool.query(
      "UPDATE category SET is_active = FALSE WHERE category_id = ?",
      [id],
    );

    return res.json({ message: "Category deactivated successfully" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ============================================================
// PATCH /api/categories/:id/reactivate
// ============================================================
const reactivateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const [existing] = await pool.query(
      "SELECT category_id, is_active FROM category WHERE category_id = ?",
      [id],
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: "Category not found" });
    }
    if (existing[0].is_active === 1) {
      return res.status(409).json({ error: "Category is already active" });
    }

    await pool.query(
      "UPDATE category SET is_active = TRUE WHERE category_id = ?",
      [id],
    );

    return res.json({ message: "Category reactivated successfully" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getAllCategories,
  getAllCategoriesAdmin,
  addCategory,
  updateCategory,
  deactivateCategory,
  reactivateCategory,
};

