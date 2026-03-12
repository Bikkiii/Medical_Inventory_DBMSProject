const mysql = require("mysql2/promise");
require("dotenv").config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

const DEFAULT_CATEGORIES = [
  ["antibiotic", "Antibacterial medicines"],
  ["analgesic", "Pain relievers"],
  ["antiviral", "Antiviral medicines"],
  ["vitamin", "Vitamins and supplements"],
  ["vaccine", "Vaccines"],
  ["topical", "Topical medicines"],
  ["other", "Other or miscellaneous"],
];

const ensureSchema = async () => {
  try {
    const [[dbRow]] = await pool.query("SELECT DATABASE() AS db");
    const dbName = dbRow?.db;
    if (!dbName) return;

    const [catTable] = await pool.query(
      `SELECT COUNT(*) AS cnt
       FROM information_schema.tables
       WHERE table_schema = ? AND table_name = 'category'`,
      [dbName],
    );

    if (catTable[0].cnt === 0) {
      await pool.query(`
        CREATE TABLE category (
          category_id INT NOT NULL AUTO_INCREMENT,
          name        VARCHAR(50) NOT NULL UNIQUE,
          description VARCHAR(255) NULL,
          is_active   BOOLEAN NOT NULL DEFAULT TRUE,
          PRIMARY KEY (category_id)
        )
      `);
    }

    const [catCount] = await pool.query(
      "SELECT COUNT(*) AS cnt FROM category",
    );
    if (catCount[0].cnt === 0) {
      const values = DEFAULT_CATEGORIES.map(() => "(?, ?, TRUE)").join(",");
      const params = DEFAULT_CATEGORIES.flat();
      await pool.query(
        `INSERT INTO category (name, description, is_active) VALUES ${values}`,
        params,
      );
    }

    const [medicineTable] = await pool.query(
      `SELECT COUNT(*) AS cnt
       FROM information_schema.tables
       WHERE table_schema = ? AND table_name = 'medicine'`,
      [dbName],
    );
    if (medicineTable[0].cnt === 0) return;

    const [hasCategoryId] = await pool.query(
      `SELECT COUNT(*) AS cnt
       FROM information_schema.columns
       WHERE table_schema = ? AND table_name = 'medicine' AND column_name = 'category_id'`,
      [dbName],
    );

    if (hasCategoryId[0].cnt === 0) {
      await pool.query("ALTER TABLE medicine ADD COLUMN category_id INT NULL");
    }

    const [hasOldCategory] = await pool.query(
      `SELECT COUNT(*) AS cnt
       FROM information_schema.columns
       WHERE table_schema = ? AND table_name = 'medicine' AND column_name = 'category'`,
      [dbName],
    );

    if (hasOldCategory[0].cnt > 0) {
      const [distinct] = await pool.query(
        "SELECT DISTINCT category FROM medicine WHERE category IS NOT NULL AND category <> ''",
      );
      for (const row of distinct) {
        await pool.query(
          "INSERT IGNORE INTO category (name, description, is_active) VALUES (?, NULL, TRUE)",
          [row.category],
        );
      }

      await pool.query(
        `UPDATE medicine m
         JOIN category c ON c.name = m.category
         SET m.category_id = c.category_id
         WHERE m.category_id IS NULL`,
      );
    }

    let otherId = null;
    const [otherRows] = await pool.query(
      "SELECT category_id FROM category WHERE name = 'other' LIMIT 1",
    );
    if (otherRows.length === 0) {
      const [inserted] = await pool.query(
        "INSERT INTO category (name, description, is_active) VALUES ('other', 'Other or miscellaneous', TRUE)",
      );
      otherId = inserted.insertId;
    } else {
      otherId = otherRows[0].category_id;
    }

    await pool.query(
      "UPDATE medicine SET category_id = ? WHERE category_id IS NULL",
      [otherId],
    );

    const [fk] = await pool.query(
      `SELECT COUNT(*) AS cnt
       FROM information_schema.KEY_COLUMN_USAGE
       WHERE table_schema = ? AND table_name = 'medicine'
         AND column_name = 'category_id' AND referenced_table_name = 'category'`,
      [dbName],
    );

    if (fk[0].cnt === 0) {
      try {
        await pool.query(
          "ALTER TABLE medicine ADD CONSTRAINT fk_medicine_category FOREIGN KEY (category_id) REFERENCES category(category_id)",
        );
      } catch (err) {
        console.warn("Skipping FK creation:", err.message);
      }
    }

    try {
      await pool.query("ALTER TABLE medicine MODIFY category_id INT NOT NULL");
    } catch (err) {
      console.warn("Skipping NOT NULL update:", err.message);
    }
  } catch (err) {
    console.warn("Schema check skipped:", err.message);
  }
};

const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log("Connected to MySQL database");
    connection.release();
    await ensureSchema();
  } catch (err) {
    console.error("Database connection failed:", err.message);
  }
};

testConnection();

module.exports = pool;
