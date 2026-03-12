const express = require("express");
const router = express.Router();

const {
  processSale,
  getAllSales,
  getSaleById,
  filterSales,
} = require("../controllers/saleController");

// POST /api/sales
// Body: { customer_name, customer_phone?, served_by, payment_mode, items[] }
router.post("/", processSale);

// GET /api/sales/filter?startDate=&endDate=&customer=&payment_mode=&sale_status=
// NOTE: must be before /:id
router.get("/filter", filterSales);

// GET /api/sales
router.get("/", getAllSales);

// GET /api/sales/:id
router.get("/:id", getSaleById);

module.exports = router;
