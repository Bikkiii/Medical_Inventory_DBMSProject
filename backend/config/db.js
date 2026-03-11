const mysql = require("mysql2");
require("dotenv").config();

// Using a connection pool instead of a single connection.
// A pool reuses existing connections instead of creating a new one
// for every request — much better for a multi-user app.
const pool = mysql.createPool({
  host:     process.env.DB_HOST     || "localhost",
  port:     process.env.DB_PORT     || 3306,
  user:     process.env.DB_USER     || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME     || "medical_inventory_db",
  waitForConnections: true,
  connectionLimit:    10,   // max 10 simultaneous connections
  queueLimit:         0,    // unlimited queued requests
});

// Wrap pool in promise API so we can use async/await
const db = pool.promise();

module.exports = db;
