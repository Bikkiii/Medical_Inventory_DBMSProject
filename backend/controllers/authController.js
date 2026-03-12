const pool = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "change_this_in_env";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";

// ============================================================
// POST /api/auth/login
// Body: { username, password }
// Returns JWT token + user info
// Frontend stores token in localStorage, reads role for UI
// ============================================================
const login = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password)
    return res
      .status(400)
      .json({ error: "username and password are required" });

  try {
    const [rows] = await pool.query("SELECT * FROM user WHERE username = ?", [
      username,
    ]);

    if (rows.length === 0)
      return res.status(401).json({ error: "Invalid username or password" });

    const user = rows[0];

    if (!user.is_active)
      return res
        .status(403)
        .json({ error: "Account deactivated. Contact an admin." });

    const match = await bcrypt.compare(password, user.password_hash);

    if (!match)
      return res.status(401).json({ error: "Invalid username or password" });

    const token = jwt.sign(
      { user_id: user.user_id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN },
    );

    return res.json({
      message: "Login successful",
      token,
      user: {
        user_id: user.user_id,
        full_name: user.full_name,
        username: user.username,
        role: user.role,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ============================================================
// GET /api/auth/me
// Requires: Authorization: Bearer <token>
// Returns logged-in user profile from DB
// Frontend calls this on page refresh to restore session
// ============================================================
const getMe = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT user_id, full_name, username, role, is_active, created_at
       FROM user WHERE user_id = ?`,
      [req.user.user_id],
    );

    if (rows.length === 0)
      return res.status(404).json({ error: "User not found" });

    return res.json(rows[0]);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ============================================================
// GET /api/auth/users
// Admin only — list all users
// ============================================================
const getAllUsers = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT user_id, full_name, username, role, is_active, created_at
       FROM user ORDER BY created_at DESC`,
    );

    if (rows.length === 0)
      return res.status(404).json({ error: "No users found" });

    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ============================================================
// POST /api/auth/register
// Admin only — create new user account
// Body: { full_name, username, password, role }
// role ENUM: 'admin' | 'pharmacist'
// ============================================================
const register = async (req, res) => {
  const { full_name, username, password, role } = req.body;

  if (!full_name || !username || !password || !role)
    return res.status(400).json({
      error: "full_name, username, password, and role are required",
    });

  if (!["admin", "pharmacist"].includes(role))
    return res.status(400).json({ error: "role must be admin or pharmacist" });

  if (password.length < 6)
    return res
      .status(400)
      .json({ error: "password must be at least 6 characters" });

  try {
    const [existing] = await pool.query(
      "SELECT user_id FROM user WHERE username = ?",
      [username],
    );

    if (existing.length > 0)
      return res.status(409).json({ error: "Username already taken" });

    const password_hash = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      `INSERT INTO user (full_name, username, password_hash, role) VALUES (?, ?, ?, ?)`,
      [full_name, username, password_hash, role],
    );

    return res.status(201).json({
      message: "User created successfully",
      userId: result.insertId,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ============================================================
// PUT /api/auth/change-password
// Any logged-in user — change their own password
// Body: { current_password, new_password }
// ============================================================
const changePassword = async (req, res) => {
  const { current_password, new_password } = req.body;

  if (!current_password || !new_password)
    return res
      .status(400)
      .json({ error: "current_password and new_password are required" });

  if (new_password.length < 6)
    return res
      .status(400)
      .json({ error: "new_password must be at least 6 characters" });

  try {
    const [rows] = await pool.query(
      "SELECT password_hash FROM user WHERE user_id = ?",
      [req.user.user_id],
    );

    const match = await bcrypt.compare(current_password, rows[0].password_hash);

    if (!match)
      return res.status(401).json({ error: "Current password is incorrect" });

    const new_hash = await bcrypt.hash(new_password, 10);

    await pool.query("UPDATE user SET password_hash = ? WHERE user_id = ?", [
      new_hash,
      req.user.user_id,
    ]);

    return res.json({ message: "Password changed successfully" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ============================================================
// PATCH /api/auth/users/:id/deactivate
// Admin only — soft-disable a user. Cannot deactivate yourself.
// ============================================================
const deactivateUser = async (req, res) => {
  const { id } = req.params;

  if (parseInt(id) === req.user.user_id)
    return res
      .status(400)
      .json({ error: "You cannot deactivate your own account" });

  try {
    const [existing] = await pool.query(
      "SELECT user_id, is_active FROM user WHERE user_id = ?",
      [id],
    );

    if (existing.length === 0)
      return res.status(404).json({ error: "User not found" });

    if (existing[0].is_active === 0)
      return res.status(409).json({ error: "User is already inactive" });

    await pool.query("UPDATE user SET is_active = FALSE WHERE user_id = ?", [
      id,
    ]);

    return res.json({ message: "User deactivated successfully" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ============================================================
// PATCH /api/auth/users/:id/reactivate
// Admin only — re-enable a deactivated user
// ============================================================
const reactivateUser = async (req, res) => {
  const { id } = req.params;

  try {
    const [existing] = await pool.query(
      "SELECT user_id, is_active FROM user WHERE user_id = ?",
      [id],
    );

    if (existing.length === 0)
      return res.status(404).json({ error: "User not found" });

    if (existing[0].is_active === 1)
      return res.status(409).json({ error: "User is already active" });

    await pool.query("UPDATE user SET is_active = TRUE WHERE user_id = ?", [
      id,
    ]);

    return res.json({ message: "User reactivated successfully" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ============================================================
// GET /api/auth/users/filter
// Flexible multi-filter for users — admin only
// All params optional, combinable
//
// ?q=john               → partial full_name or username match
// ?is_active=true       → active users only
// ?is_active=false      → deactivated users only
//                          (omit is_active to get ALL)
// ?role=admin           → filter by role (admin | pharmacist)
//
// Examples:
//   /filter?is_active=false               → all deactivated users
//   /filter?role=pharmacist               → all pharmacists
//   /filter?role=pharmacist&is_active=true → active pharmacists only
//   /filter?q=john&is_active=false        → deactivated + name match
//   /filter                               → all users
// ============================================================
const filterUsers = async (req, res) => {
  try {
    const { q, is_active, role } = req.query;

    let sql = `
      SELECT user_id, full_name, username, role, is_active, created_at
      FROM user WHERE 1=1
    `;
    const params = [];

    // Partial name or username search
    if (q) {
      sql += ` AND (full_name LIKE ? OR username LIKE ?)`;
      params.push(`%${q}%`, `%${q}%`);
    }

    // is_active filter — true, false, or omit for all
    if (is_active === "true") {
      sql += ` AND is_active = TRUE`;
    } else if (is_active === "false") {
      sql += ` AND is_active = FALSE`;
    }

    // Role filter
    if (role) {
      if (!["admin", "pharmacist"].includes(role)) {
        return res
          .status(400)
          .json({ error: "role must be admin or pharmacist" });
      }
      sql += ` AND role = ?`;
      params.push(role);
    }

    sql += ` ORDER BY created_at DESC`;

    const [rows] = await pool.query(sql, params);

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ error: "No users found matching the criteria" });
    }

    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = {
  login,
  getMe,
  getAllUsers,
  register,
  changePassword,
  deactivateUser,
  reactivateUser,
  filterUsers,
};
