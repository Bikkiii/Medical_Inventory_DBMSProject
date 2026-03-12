const express = require("express");
const router = express.Router();

const {
  getAllMedicines,
  getAllMedicinesAdmin,
  getMedicineById,
  addMedicine,
  updateMedicine,
  deactivateMedicine,
  reactivateMedicine,
  filterMedicines,
} = require("../controllers/medicineController");

const { authenticate, requireAdmin } = require("../middleware/authMiddleware");

// POST /api/medicines
// Body: { medicine_name, brand_name?, category, strength?, reorder_level? }
router.post("/", authenticate, requireAdmin, addMedicine);

// GET /api/medicines/all
// Returns ALL medicines including inactive — admin use only
// NOTE: must be before /:id
router.get("/all", authenticate, requireAdmin, getAllMedicinesAdmin);

// GET /api/medicines/filter?q=&is_active=&category=&brand=
// Flexible filter — all params optional, combinable
// NOTE: must be before /:id
router.get("/filter", authenticate, requireAdmin, filterMedicines);

// GET /api/medicines
// Returns active medicines only — for sale/batch dropdowns
router.get("/", authenticate, getAllMedicines);

// GET /api/medicines/:id
router.get("/:id", authenticate, requireAdmin, getMedicineById);

// PUT /api/medicines/:id
// Body: any subset of { medicine_name?, brand_name?, category?, strength?, reorder_level? }
router.put("/:id", authenticate, requireAdmin, updateMedicine);

// PATCH /api/medicines/:id/deactivate
// FIX: Soft delete — sets is_active = FALSE via sp_deactivate_medicine
// Blocks future sales of this medicine via procedure + trigger
router.patch("/:id/deactivate", authenticate, requireAdmin, deactivateMedicine);

// PATCH /api/medicines/:id/reactivate
router.patch("/:id/reactivate", authenticate, requireAdmin, reactivateMedicine);

module.exports = router;
