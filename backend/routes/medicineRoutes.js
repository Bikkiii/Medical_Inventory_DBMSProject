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

// POST /api/medicines
// Body: { medicine_name, brand_name?, category, strength?, reorder_level? }
router.post("/", addMedicine);

// GET /api/medicines/all
// Returns ALL medicines including inactive — admin use only
// NOTE: must be before /:id
router.get("/all", getAllMedicinesAdmin);

// GET /api/medicines/filter?q=&is_active=&category=&brand=
// Flexible filter — all params optional, combinable
// NOTE: must be before /:id
router.get("/filter", filterMedicines);

// GET /api/medicines
// Returns active medicines only — for sale/batch dropdowns
router.get("/", getAllMedicines);

// GET /api/medicines/:id
router.get("/:id", getMedicineById);

// PUT /api/medicines/:id
// Body: any subset of { medicine_name?, brand_name?, category?, strength?, reorder_level? }
router.put("/:id", updateMedicine);

// PATCH /api/medicines/:id/deactivate
// FIX: Soft delete — sets is_active = FALSE via sp_deactivate_medicine
// Blocks future sales of this medicine via procedure + trigger
router.patch("/:id/deactivate", deactivateMedicine);

// PATCH /api/medicines/:id/reactivate
router.patch("/:id/reactivate", reactivateMedicine);

module.exports = router;
