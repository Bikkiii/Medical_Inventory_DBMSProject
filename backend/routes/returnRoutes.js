const express = require("express");
const router = express.Router();

const {
  processCustomerReturn,
  reportDamage,
  getAllReturns,
  getReturnById,
  filterReturns,
} = require("../controllers/returnController");

// POST /api/returns/customer
// Body: { sale_item_id, quantity_returned, reason, resolution, processed_by }
router.post("/customer", processCustomerReturn);

// POST /api/returns/damage
// Body: { batch_item_id, quantity_damaged, damage_cause, resolution, processed_by }
router.post("/damage", reportDamage);

// GET /api/returns/filter?return_type=&resolution=&startDate=&endDate=
// NOTE: must be before /:id
router.get("/filter", filterReturns);

// GET /api/returns
router.get("/", getAllReturns);

// GET /api/returns/:id
router.get("/:id", getReturnById);

module.exports = router;
