const express = require("express");
const router = express.Router();

const {
  getAllSuppliers,
  getAllSuppliersAdmin,
  getSupplierById,
  addSupplier,
  updateSupplier,
  deactivateSupplier,
  reactivateSupplier,
  filterSuppliers,
} = require("../controllers/supplierController");

// POST /api/suppliers
// Body: { supplier_name, phone, email?, address? }
router.post("/", addSupplier);

// GET /api/suppliers/filter?q=&is_active=&phone=
// Flexible filter — all params optional, combinable
// NOTE: must be before /:id so "filter" isn't treated as an id
router.get("/filter", filterSuppliers);

// GET /api/suppliers/all
// Returns ALL suppliers including inactive — admin use only
// NOTE: must be before /:id
router.get("/all", getAllSuppliersAdmin);

// GET /api/suppliers
// Returns active suppliers only — for dropdowns
router.get("/", getAllSuppliers);

// GET /api/suppliers/:id
router.get("/:id", getSupplierById);

// PUT /api/suppliers/:id
// Body: any of { supplier_name?, phone?, email?, address? }
router.put("/:id", updateSupplier);

// PATCH /api/suppliers/:id/deactivate
// FIX: Soft delete — sets is_active = FALSE via sp_deactivate_supplier
// Replaces hard DELETE — preserves all historical batch/return records
router.patch("/:id/deactivate", deactivateSupplier);

// PATCH /api/suppliers/:id/reactivate
router.patch("/:id/reactivate", reactivateSupplier);

module.exports = router;
