const express  = require("express");
const router   = express.Router();
const db       = require("../config/db");
const validate = require("../middleware/validate");

// GET /api/suppliers
router.get("/", async (req, res, next) => {
  try {
    const [rows] = await db.query("SELECT * FROM supplier ORDER BY supplier_name");
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/suppliers/:id
router.get("/:id", async (req, res, next) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM supplier WHERE supplier_id = ?",
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Supplier not found." });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// POST /api/suppliers
router.post("/", async (req, res, next) => {
  try {
    const { supplier_name, phone, email, address } = req.body;

    validate(supplier_name, "supplier_name is required");
    validate(phone,         "phone is required");

    const [result] = await db.query(
      "INSERT INTO supplier (supplier_name, phone, email, address) VALUES (?, ?, ?, ?)",
      [supplier_name, phone, email || null, address || null]
    );

    res.status(201).json({ message: "Supplier created.", supplier_id: result.insertId });
  } catch (err) {
    next(err);
  }
});

// PUT /api/suppliers/:id
router.put("/:id", async (req, res, next) => {
  try {
    const { supplier_name, phone, email, address } = req.body;

    validate(supplier_name, "supplier_name is required");
    validate(phone,         "phone is required");

    const [result] = await db.query(
      "UPDATE supplier SET supplier_name = ?, phone = ?, email = ?, address = ? WHERE supplier_id = ?",
      [supplier_name, phone, email || null, address || null, req.params.id]
    );

    if (result.affectedRows === 0) return res.status(404).json({ error: "Supplier not found." });
    res.json({ message: "Supplier updated." });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
