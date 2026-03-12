const pool = require("../config/db");

// ============================================================
// POST /api/sales
// Process a new sale with one or multiple items.
//
// FIX: Removed sp_add_sale_item — this procedure does not exist
//      in the schema. All items loop through sp_process_sale
//      for the first item (creates sale header), then raw
//      INSERT into sale_item for subsequent items.
//      sale.total_amount is updated after all items are inserted.
//
// FIX: Removed generic_name, form, unit from queries
//      — these columns do not exist in the medicine schema
//
// Flow:
//   Item 1 → sp_process_sale → creates sale header + item 1
//             returns created_sale_id
//   Item 2+ → INSERT sale_item directly
//             triggers handle stock check + stock deduction
//   After all items → UPDATE sale.total_amount to correct total
//
// Body:
// {
//   customer_name:  string (required)
//   customer_phone: string (optional)
//   served_by:      int    (required — user_id)
//   payment_mode:   'cash'|'card'|'upi'|'insurance' (required)
//   items: [{
//     batch_item_id: int
//     medicine_id:   int
//     quantity_sold: int
//     unit_price:    decimal
//     discount_pct:  decimal (optional, default 0)
//   }]
// }
// ============================================================
const processSale = async (req, res) => {
  const { customer_name, customer_phone, served_by, payment_mode, items } =
    req.body;

  if (
    !customer_name ||
    !served_by ||
    !payment_mode ||
    !items ||
    items.length === 0
  ) {
    return res.status(400).json({
      error:
        "customer_name, served_by, payment_mode, and at least one item are required",
    });
  }

  const validPaymentModes = ["cash", "card", "upi", "insurance"];
  if (!validPaymentModes.includes(payment_mode)) {
    return res.status(400).json({
      error: `payment_mode must be one of: ${validPaymentModes.join(", ")}`,
    });
  }

  // Validate all items have required fields
  for (const item of items) {
    if (
      !item.batch_item_id ||
      !item.medicine_id ||
      !item.quantity_sold ||
      !item.unit_price
    ) {
      return res.status(400).json({
        error:
          "Each item requires: batch_item_id, medicine_id, quantity_sold, unit_price",
      });
    }
  }

  try {
    let sale_id = null;
    let total_amount = 0;

    for (let i = 0; i < items.length; i++) {
      const {
        batch_item_id,
        medicine_id,
        quantity_sold,
        unit_price,
        discount_pct = 0,
      } = items[i];

      // Check batch_item exists and is not expired before selling
      const [bi] = await pool.query(
        "SELECT expiry_date FROM batch_item WHERE batch_item_id = ?",
        [batch_item_id],
      );

      if (bi.length === 0) {
        return res
          .status(404)
          .json({ error: `batch_item_id ${batch_item_id} not found` });
      }

      if (new Date(bi[0].expiry_date) < new Date()) {
        return res.status(409).json({
          error: `batch_item_id ${batch_item_id} is expired and cannot be sold`,
        });
      }

      const subtotal = quantity_sold * unit_price * (1 - discount_pct / 100);
      total_amount += subtotal;

      if (i === 0) {
        // First item — sp_process_sale creates sale header + first item atomically
        // Handles: transaction, FOR UPDATE lock, medicine is_active check,
        //          stock check, rollback on failure
        const [rows] = await pool.query(
          "CALL sp_process_sale(?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [
            customer_name,
            customer_phone || null,
            served_by,
            payment_mode,
            batch_item_id,
            medicine_id,
            quantity_sold,
            unit_price,
            discount_pct,
          ],
        );
        // sp_process_sale returns: SELECT v_sale_id AS created_sale_id
        // Guard: if rows[0] is missing or empty, the SP did not return a result
        // (can happen if SP threw SIGNAL but driver didn't surface it as an exception)
        if (!rows || !rows[0] || !rows[0][0] || !rows[0][0].created_sale_id) {
          return res.status(409).json({
            error:
              "Sale failed: medicine may be discontinued or insufficient stock.",
          });
        }
        sale_id = rows[0][0].created_sale_id;
      } else {
        // Subsequent items — INSERT directly into sale_item
        // trg_before_sale_item_insert fires → checks medicine is_active + stock
        // trg_after_sale_item_insert fires  → deducts stock in stock_ledger
        const subtotalItem =
          quantity_sold * unit_price * (1 - discount_pct / 100);

        await pool.query(
          `INSERT INTO sale_item
             (sale_id, batch_item_id, medicine_id, quantity_sold, unit_price, discount_pct, subtotal)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            sale_id,
            batch_item_id,
            medicine_id,
            quantity_sold,
            unit_price,
            discount_pct,
            subtotalItem,
          ],
        );
      }
    }

    // FIX: Update total_amount to reflect ALL items
    // sp_process_sale only sets total_amount for item 1
    // so we recalculate and update after all items are inserted
    await pool.query("UPDATE sale SET total_amount = ? WHERE sale_id = ?", [
      total_amount,
      sale_id,
    ]);

    return res.status(201).json({
      message: "Sale processed successfully",
      saleId: sale_id,
      total_amount: parseFloat(total_amount.toFixed(2)),
    });
  } catch (err) {
    // MySQL SIGNAL errors from triggers/procedures use sqlState '45000'
    // Some drivers surface this as err.sqlState, others as err.code = 'ER_SIGNAL_EXCEPTION'
    if (err.sqlState === "45000" || err.code === "ER_SIGNAL_EXCEPTION") {
      return res.status(409).json({ error: err.message });
    }
    return res.status(500).json({ error: err.message });
  }
};

// ============================================================
// GET /api/sales
// All sales with served_by user info
// ============================================================
const getAllSales = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        s.sale_id,
        s.sale_date,
        s.customer_name,
        s.customer_phone,
        s.total_amount,
        s.payment_mode,
        s.sale_status,
        u.username  AS served_by,
        u.full_name AS served_by_full_name
      FROM sale s
      JOIN user u ON u.user_id = s.served_by
      ORDER BY s.sale_date DESC
    `);

    if (rows.length === 0) {
      return res.status(404).json({ error: "No sales found" });
    }

    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ============================================================
// GET /api/sales/:id
// Single sale with all items, medicine details, batch info
// FIX: Removed generic_name, form, unit from SELECT and response
//      — these columns do not exist in the medicine schema
// ============================================================
const getSaleById = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
        s.sale_id,
        s.sale_date,
        s.customer_name,
        s.customer_phone,
        s.total_amount,
        s.payment_mode,
        s.sale_status,
        u.username        AS served_by,
        u.full_name       AS served_by_full_name,
        si.sale_item_id,
        si.batch_item_id,
        si.medicine_id,
        m.medicine_name,
        m.brand_name,
        m.category,
        m.strength,
        b.batch_no,
        si.quantity_sold,
        si.unit_price,
        si.discount_pct,
        si.subtotal
      FROM sale s
      JOIN user       u   ON u.user_id         = s.served_by
      JOIN sale_item  si  ON si.sale_id         = s.sale_id
      JOIN medicine   m   ON m.medicine_id      = si.medicine_id
      JOIN batch_item bi  ON bi.batch_item_id   = si.batch_item_id
      JOIN batch      b   ON b.batch_id         = bi.batch_id
      WHERE s.sale_id = ?`,
      [req.params.id],
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Sale not found" });
    }

    const sale = {
      sale_id: rows[0].sale_id,
      sale_date: rows[0].sale_date,
      customer_name: rows[0].customer_name,
      customer_phone: rows[0].customer_phone,
      total_amount: rows[0].total_amount,
      payment_mode: rows[0].payment_mode,
      sale_status: rows[0].sale_status,
      served_by: rows[0].served_by,
      served_by_full_name: rows[0].served_by_full_name,
      items: rows.map((row) => ({
        sale_item_id: row.sale_item_id,
        batch_item_id: row.batch_item_id,
        medicine_id: row.medicine_id,
        medicine_name: row.medicine_name,
        brand_name: row.brand_name,
        category: row.category,
        strength: row.strength,
        batch_no: row.batch_no,
        quantity_sold: row.quantity_sold,
        unit_price: row.unit_price,
        discount_pct: row.discount_pct,
        subtotal: row.subtotal,
      })),
    };

    return res.json(sale);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ============================================================
// GET /api/sales/filter
// ?startDate=2025-01-01&endDate=2025-03-31
// ?customer=ram
// ?payment_mode=cash|card|upi|insurance
// ?sale_status=completed|partially_returned|fully_returned
// ============================================================
const filterSales = async (req, res) => {
  try {
    const { startDate, endDate, customer, payment_mode, sale_status } =
      req.query;

    let sql = `
      SELECT
        s.sale_id,
        s.sale_date,
        s.customer_name,
        s.customer_phone,
        s.total_amount,
        s.payment_mode,
        s.sale_status,
        u.username  AS served_by,
        u.full_name AS served_by_full_name
      FROM sale s
      JOIN user u ON u.user_id = s.served_by
      WHERE 1=1
    `;
    const params = [];

    if (startDate && endDate) {
      sql += ` AND DATE(s.sale_date) BETWEEN ? AND ?`;
      params.push(startDate, endDate);
    }

    if (customer) {
      sql += ` AND s.customer_name LIKE ?`;
      params.push(`%${customer}%`);
    }

    if (payment_mode) {
      sql += ` AND s.payment_mode = ?`;
      params.push(payment_mode);
    }

    if (sale_status) {
      sql += ` AND s.sale_status = ?`;
      params.push(sale_status);
    }

    sql += ` ORDER BY s.sale_date DESC`;

    const [rows] = await pool.query(sql, params);

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ error: "No sales found matching the criteria" });
    }

    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = {
  processSale,
  getAllSales,
  getSaleById,
  filterSales,
};
