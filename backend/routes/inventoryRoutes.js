const express = require("express");
const router = express.Router();

const {
  getAllStocks,
  getExpiryAlerts,
  getLowStock,
  getLedger,
} = require("../controllers/inventoryController");

const { authenticate } = require("../middleware/authMiddleware");

// GET /api/inventory/current-stock
router.get("/current-stock", authenticate, getAllStocks);

// GET /api/inventory/expiry-alerts
router.get("/expiry-alerts", authenticate, getExpiryAlerts);

// GET /api/inventory/low-stock
router.get("/low-stock", authenticate, getLowStock);

// GET /api/inventory/ledger
router.get("/ledger", authenticate, getLedger);

module.exports = router;
