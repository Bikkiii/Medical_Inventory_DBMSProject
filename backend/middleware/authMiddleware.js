const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "change_this_in_env";

// ============================================================
// authenticate
// Verifies Bearer token from Authorization header
// Attaches decoded { user_id, username, role } to req.user
// Use on any route that needs a logged-in user
// ============================================================
const authenticate = (req, res, next) => {
  const authHeader = req.headers["authorization"];

  if (!authHeader || !authHeader.startsWith("Bearer "))
    return res.status(401).json({ error: "Authorization token required" });

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { user_id, username, role, iat, exp }
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError")
      return res
        .status(401)
        .json({ error: "Token expired. Please log in again." });
    return res.status(401).json({ error: "Invalid token" });
  }
};

// ============================================================
// requireAdmin
// Must be used AFTER authenticate
// Blocks non-admin users (pharmacists) from the route
// ============================================================
const requireAdmin = (req, res, next) => {
  if (req.user.role !== "admin")
    return res
      .status(403)
      .json({ error: "Access denied. Admin role required." });
  next();
};

module.exports = { authenticate, requireAdmin };
