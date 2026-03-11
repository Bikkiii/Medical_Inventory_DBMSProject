module.exports = (err, req, res, next) => {
  console.error("FULL ERROR:", err);
  res.status(err.status || 500).json({
    error: err.message || "Internal server error.",
    sql: err.sql || undefined,
    sqlMessage: err.sqlMessage || undefined,
    code: err.code || undefined,
  });
};
