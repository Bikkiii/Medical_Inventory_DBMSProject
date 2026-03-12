const express = require("express");
const router = express.Router();

const {
  getAllCategories,
  getAllCategoriesAdmin,
  addCategory,
  updateCategory,
  deactivateCategory,
  reactivateCategory,
} = require("../controllers/categoryController");

const { authenticate, requireAdmin } = require("../middleware/authMiddleware");

// GET /api/categories (active only)
router.get("/", authenticate, getAllCategories);

// GET /api/categories/all (admin)
router.get("/all", authenticate, requireAdmin, getAllCategoriesAdmin);

// POST /api/categories (admin)
router.post("/", authenticate, requireAdmin, addCategory);

// PUT /api/categories/:id (admin)
router.put("/:id", authenticate, requireAdmin, updateCategory);

// PATCH /api/categories/:id/deactivate (admin)
router.patch("/:id/deactivate", authenticate, requireAdmin, deactivateCategory);

// PATCH /api/categories/:id/reactivate (admin)
router.patch("/:id/reactivate", authenticate, requireAdmin, reactivateCategory);

module.exports = router;

