const express = require("express");
const router = express.Router();

const {
  addBatch,
  getAllBatches,
  getBatchDetails,
  getFilteredBatches,
} = require("../controllers/batchController");

// POST /api/batches
// Body: { batch_no, supplier_id, received_by, received_date?, invoice_no?, notes?, items[] }
router.post("/", addBatch);

// GET /api/batches/filter?q=BATCH&supplier_id=1&startDate=&endDate=
// NOTE: specific routes before /:id
router.get("/filter", getFilteredBatches);

// GET /api/batches
router.get("/", getAllBatches);

// GET /api/batches/:id
router.get("/:id", getBatchDetails);

module.exports = router;
