const express = require("express");
const router = express.Router();

const {
  getAllStocks,
  getExpiryAlerts,
  getLowStock,
} = require("../controllers/inventoryController");

// GET /api/inventory/current-stock
router.get("/current-stock", getAllStocks);

// GET /api/inventory/expiry-alerts
router.get("/expiry-alerts", getExpiryAlerts);

// GET /api/inventory/low-stock
router.get("/low-stock", getLowStock);

module.exports = router;
