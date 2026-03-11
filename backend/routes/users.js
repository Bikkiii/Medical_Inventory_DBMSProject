const express  = require("express");
const router   = express.Router();
const db       = require("../config/db");
const validate = require("../middleware/validate");

// GET /api/users
// Returns all users (passwords excluded)
router.get("/", async (req, res, next) => {
  try {
    const [rows] = await db.query(
      "SELECT user_id, full_name, username, role, is_active, created_at FROM user"
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/users/:id
router.get("/:id", async (req, res, next) => {
  try {
    const [rows] = await db.query(
      "SELECT user_id, full_name, username, role, is_active, created_at FROM user WHERE user_id = ?",
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "User not found." });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// POST /api/users
// Create a new user
router.post("/", async (req, res, next) => {
  try {
    const { full_name, username, password_hash, role } = req.body;

    validate(full_name,     "full_name is required");
    validate(username,      "username is required");
    validate(password_hash, "password_hash is required");
    validate(role,          "role is required (admin or pharmacist)");

    const [result] = await db.query(
      "INSERT INTO user (full_name, username, password_hash, role) VALUES (?, ?, ?, ?)",
      [full_name, username, password_hash, role]
    );

    res.status(201).json({ message: "User created.", user_id: result.insertId });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
