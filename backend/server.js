const express = require("express");
const cors = require("cors");
require("dotenv").config();

require("./config/db");

const app = express();
app.use(cors());
app.use(express.json());

const medicineRoutes = require("./routes/medicineRoutes");
app.use("/api/medicines", medicineRoutes);

const batchRoutes = require("./routes/batchRoutes");
app.use("/api/batches", batchRoutes);

const inventoryRoutes = require("./routes/inventoryRoutes");
app.use("/api/inventory", inventoryRoutes);

const supplierRoutes = require("./routes/supplierRoutes");
app.use("/api/suppliers", supplierRoutes);

const categoryRoutes = require("./routes/categoryRoutes");
app.use("/api/categories", categoryRoutes);

const saleRoutes = require("./routes/saleRoutes");
app.use("/api/sales", saleRoutes);

const authRoutes = require("./routes/authRoutes");
app.use("/api/auth", authRoutes);

const returnRoutes = require("./routes/returnRoutes");
app.use("/api/returns", returnRoutes);

app.get("/", (req, res) => {
  res.json({ message: "Medical Inventory API is running" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log("Server running on http://localhost:" + PORT);
});
