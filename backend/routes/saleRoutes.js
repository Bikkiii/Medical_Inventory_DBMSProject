const express = require("express");
const router = express.Router();

const {
  processSale,
  getAllSales,
  getSaleById,
  filterSales,
} = require("../controllers/saleController");

const { authenticate } = require("../middleware/authMiddleware");

// POST /api/sales
// Body: { customer_name, customer_phone?, served_by, payment_mode, items[] }
router.post("/", authenticate, processSale);

// GET /api/sales/filter?startDate=&endDate=&customer=&payment_mode=&sale_status=
// NOTE: must be before /:id
router.get("/filter", authenticate, filterSales);

// GET /api/sales
router.get("/", authenticate, getAllSales);

// GET /api/sales/:id
router.get("/:id", authenticate, getSaleById);

module.exports = router;
