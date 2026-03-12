const express = require("express");
const router = express.Router();

const {
  processCustomerReturn,
  reportDamage,
  getAllReturns,
  getReturnById,
  filterReturns,
} = require("../controllers/returnController");

const { authenticate } = require("../middleware/authMiddleware");

// POST /api/returns/customer
// Body: { sale_item_id, quantity_returned, reason, resolution, processed_by }
router.post("/customer", authenticate, processCustomerReturn);

// POST /api/returns/damage
// Body: { batch_item_id, quantity_damaged, damage_cause, resolution, processed_by }
router.post("/damage", authenticate, reportDamage);

// GET /api/returns/filter?return_type=&resolution=&startDate=&endDate=
// NOTE: must be before /:id
router.get("/filter", authenticate, filterReturns);

// GET /api/returns
router.get("/", authenticate, getAllReturns);

// GET /api/returns/:id
router.get("/:id", authenticate, getReturnById);

module.exports = router;
