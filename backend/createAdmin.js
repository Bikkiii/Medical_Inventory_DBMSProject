const bcrypt = require("bcrypt");
const pool = require("./config/db");

async function createAdmin() {
  const hash = await bcrypt.hash("admin123", 10);

  const [existing] = await pool.query(
    "SELECT user_id FROM user WHERE username = ?",
    ["superadmin"],
  );

  if (existing.length > 0) {
    console.log("Admin already exists: superadmin");
    process.exit();
  }

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
