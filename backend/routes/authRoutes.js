const express = require("express");
const router = express.Router();

const {
  login,
  getMe,
  getAllUsers,
  register,
  changePassword,
  deactivateUser,
  reactivateUser,
  filterUsers,
} = require("../controllers/authController");

const { authenticate, requireAdmin } = require("../middleware/authMiddleware");

// ── Public ───────────────────────────────────────────────────
// POST /api/auth/login
// Body: { username, password }
router.post("/login", login);

// ── Any logged-in user ───────────────────────────────────────
// GET  /api/auth/me
router.get("/me", authenticate, getMe);

// PUT  /api/auth/change-password
// Body: { current_password, new_password }
router.put("/change-password", authenticate, changePassword);

// ── Admin only ───────────────────────────────────────────────
// GET  /api/auth/users
router.get("/users", authenticate, requireAdmin, getAllUsers);

// GET  /api/auth/users/filter?q=&is_active=&role=
// NOTE: must be before /users/:id
router.get("/users/filter", authenticate, requireAdmin, filterUsers);

// POST /api/auth/register
// Body: { full_name, username, password, role }
router.post("/register", authenticate, requireAdmin, register);

// PATCH /api/auth/users/:id/deactivate
router.patch(
  "/users/:id/deactivate",
  authenticate,
  requireAdmin,
  deactivateUser,
);

// PATCH /api/auth/users/:id/reactivate
router.patch(
  "/users/:id/reactivate",
  authenticate,
  requireAdmin,
  reactivateUser,
);

module.exports = router;
