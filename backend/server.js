const express      = require("express");
const cors         = require("cors");
require("dotenv").config();

const errorHandler = require("./middleware/errorHandler");

// Route files
const usersRouter     = require("./routes/users");
const suppliersRouter = require("./routes/suppliers");
const medicinesRouter = require("./routes/medicines");
const batchesRouter   = require("./routes/batches");
const stockRouter     = require("./routes/stock");
const salesRouter     = require("./routes/sales");
const returnsRouter   = require("./routes/returns");

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────────────────────

// Allow requests from the React frontend (running on a different port in dev)
app.use(cors({ origin: "http://localhost:5173" }));

// Parse incoming JSON request bodies
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────────────

app.use("/api/users",     usersRouter);
app.use("/api/suppliers", suppliersRouter);
app.use("/api/medicines", medicinesRouter);
app.use("/api/batches",   batchesRouter);
app.use("/api/stock",     stockRouter);
app.use("/api/sales",     salesRouter);
app.use("/api/returns",   returnsRouter);

// Health check — useful to quickly verify the server is running
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Medical Store IMS API is running." });
});

// 404 for unknown routes
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found.` });
});

// ── Central Error Handler ─────────────────────────────────────────────────────
// Must be registered AFTER all routes
app.use(errorHandler);

// ── Start Server ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
