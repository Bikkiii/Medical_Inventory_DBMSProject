const bcrypt = require("bcrypt");
const pool = require("./config/db");

async function createAdmin() {
  const hash = await bcrypt.hash("admin123", 10);

  await pool.query(
    `INSERT INTO user (full_name, username, password_hash, role, is_active)
     VALUES (?, ?, ?, ?, TRUE)`,
    ["Super Admin", "superadmin", hash, "admin"],
  );

  console.log("✅ Admin created!");
  console.log("Username: superadmin");
  console.log("Password: admin123");
  process.exit();
}

createAdmin();
