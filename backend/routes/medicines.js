const express  = require("express");
const router   = express.Router();
const db       = require("../config/db");
const validate = require("../middleware/validate");

// GET /api/medicines
router.get("/", async (req, res, next) => {
  try {
    const [rows] = await db.query("SELECT * FROM medicine ORDER BY medicine_name");
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/medicines/:id
router.get("/:id", async (req, res, next) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM medicine WHERE medicine_id = ?",
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Medicine not found." });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// POST /api/medicines
router.post("/", async (req, res, next) => {
  try {
    const {
      medicine_name, generic_name, brand_name,
      category, form, strength, unit, reorder_level,
    } = req.body;

    validate(medicine_name, "medicine_name is required");
    validate(category,      "category is required");
    validate(form,          "form is required");
    validate(unit,          "unit is required");

    const [result] = await db.query(
      `INSERT INTO medicine
         (medicine_name, generic_name, brand_name, category, form, strength, unit, reorder_level)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        medicine_name,
        generic_name   || null,
        brand_name     || null,
        category,
        form,
        strength       || null,
        unit,
        reorder_level  || 0,
      ]
    );

    res.status(201).json({ message: "Medicine created.", medicine_id: result.insertId });
  } catch (err) {
    next(err);
  }
});

// PUT /api/medicines/:id
router.put("/:id", async (req, res, next) => {
  try {
    const {
      medicine_name, generic_name, brand_name,
      category, form, strength, unit, reorder_level,
    } = req.body;

    validate(medicine_name, "medicine_name is required");

    const [result] = await db.query(
      `UPDATE medicine
       SET medicine_name = ?, generic_name = ?, brand_name = ?,
           category = ?, form = ?, strength = ?, unit = ?, reorder_level = ?
       WHERE medicine_id = ?`,
      [medicine_name, generic_name, brand_name, category, form, strength, unit, reorder_level, req.params.id]
    );

    if (result.affectedRows === 0) return res.status(404).json({ error: "Medicine not found." });
    res.json({ message: "Medicine updated." });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
