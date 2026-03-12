USE medical_inventory_db;

-- ============================================================
-- VIEW 1: vw_current_stock
-- Shows live stock for every received batch_item
-- stock = SUM of all quantity_change in stock_ledger
-- (purchases add, sales/damage/returns subtract)
-- expiry_status and stock_status used for dashboard alerts
-- FIX: No filter on is_active here — this view is used for
--      stock management and must show ALL stock including
--      stock from inactive suppliers or discontinued medicines
--      (you still need to write off or return that physical stock)
-- ============================================================
CREATE OR REPLACE VIEW vw_current_stock AS
SELECT
    m.medicine_id,
    m.medicine_name,
    m.brand_name,
    m.category,
    m.strength,
    m.is_active                                         AS medicine_active,  -- FIX: expose flag for frontend
    bi.batch_item_id,
    bi.expiry_date,
    bi.unit_price,
    b.batch_no,
    b.received_date,
    s.supplier_name,
    s.is_active                                         AS supplier_active,  -- FIX: expose flag for frontend

    -- Live stock = sum of all ledger movements for this batch_item
    COALESCE(SUM(sl.quantity_change), 0)                AS current_stock,

    DATEDIFF(bi.expiry_date, CURDATE())                 AS days_until_expiry,

    -- Expiry status for frontend badge/alert
    CASE
        WHEN bi.expiry_date < CURDATE()                        THEN 'expired'
        WHEN DATEDIFF(bi.expiry_date, CURDATE()) <= 30         THEN 'expiring_30_days'
        WHEN DATEDIFF(bi.expiry_date, CURDATE()) <= 60         THEN 'expiring_60_days'
        WHEN DATEDIFF(bi.expiry_date, CURDATE()) <= 90         THEN 'expiring_90_days'
        ELSE 'ok'
    END AS expiry_status,

    -- Stock status compared to reorder_level threshold
    CASE
        WHEN COALESCE(SUM(sl.quantity_change), 0) <= 0               THEN 'out_of_stock'
        WHEN COALESCE(SUM(sl.quantity_change), 0) <= m.reorder_level THEN 'low_stock'
        ELSE 'ok'
    END AS stock_status

FROM batch_item bi
JOIN medicine      m  ON m.medicine_id    = bi.medicine_id
JOIN batch         b  ON b.batch_id       = bi.batch_id
JOIN supplier      s  ON s.supplier_id    = b.supplier_id
LEFT JOIN stock_ledger sl ON sl.batch_item_id = bi.batch_item_id
GROUP BY
    m.medicine_name, m.brand_name, m.category, m.strength, m.is_active,
    bi.batch_item_id, bi.expiry_date, bi.unit_price,
    b.batch_no, b.received_date, s.supplier_name, s.is_active, m.reorder_level;


-- ============================================================
-- VIEW 2: vw_expiry_alert
-- Shows only medicines expiring within 90 days
-- Excludes fully depleted stock (current_stock > 0)
-- Used for dashboard expiry warning panel
-- FIX: Includes both active and inactive medicines —
--      expired/expiring stock from a discontinued medicine
--      still needs to be actioned (written off or returned)
-- ============================================================
CREATE OR REPLACE VIEW vw_expiry_alert AS
SELECT
    m.medicine_name,
    m.brand_name,
    m.is_active                                         AS medicine_active,  -- FIX: expose flag
    b.batch_no,
    s.supplier_name,
    s.is_active                                         AS supplier_active,  -- FIX: expose flag
    bi.expiry_date,
    DATEDIFF(bi.expiry_date, CURDATE())                 AS days_until_expiry,
    COALESCE(SUM(sl.quantity_change), 0)                AS current_stock,

    -- Alert level label for frontend display
    CASE
        WHEN bi.expiry_date < CURDATE()                        THEN 'EXPIRED'
        WHEN DATEDIFF(bi.expiry_date, CURDATE()) <= 30         THEN 'EXPIRING IN 30 DAYS'
        WHEN DATEDIFF(bi.expiry_date, CURDATE()) <= 60         THEN 'EXPIRING IN 60 DAYS'
        WHEN DATEDIFF(bi.expiry_date, CURDATE()) <= 90         THEN 'EXPIRING IN 90 DAYS'
    END AS alert_level

FROM batch_item bi
JOIN medicine      m  ON m.medicine_id    = bi.medicine_id
JOIN batch         b  ON b.batch_id       = bi.batch_id
JOIN supplier      s  ON s.supplier_id    = b.supplier_id
LEFT JOIN stock_ledger sl ON sl.batch_item_id = bi.batch_item_id

-- Only show medicines expiring within 90 days
WHERE bi.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 90 DAY)

GROUP BY
    m.medicine_name, m.brand_name, m.is_active, b.batch_no,
    s.supplier_name, s.is_active, bi.expiry_date, bi.batch_item_id

-- Only show if stock still exists (no point alerting on empty stock)
HAVING COALESCE(SUM(sl.quantity_change), 0) > 0

ORDER BY bi.expiry_date ASC;


-- ============================================================
-- VIEW 3: vw_low_stock
-- Shows medicines at or below their reorder_level threshold
-- Aggregates across all batches for that medicine
-- Used for dashboard low stock / reorder panel
-- FIX: Filter to is_active = TRUE only
--      No point raising a reorder alert for a discontinued
--      medicine — you wouldn't be ordering more of it anyway
-- ============================================================
CREATE OR REPLACE VIEW vw_low_stock AS
SELECT
    m.medicine_name,
    m.brand_name,
    m.category,
    m.reorder_level,
    COALESCE(SUM(sl.quantity_change), 0)                              AS total_stock,

    -- How many units short of the reorder level
    m.reorder_level - COALESCE(SUM(sl.quantity_change), 0)           AS shortage_quantity,

    -- Alert label for frontend display
    CASE
        WHEN COALESCE(SUM(sl.quantity_change), 0) <= 0               THEN 'OUT OF STOCK'
        WHEN COALESCE(SUM(sl.quantity_change), 0) <= m.reorder_level THEN 'LOW STOCK'
    END AS stock_alert

FROM medicine m
JOIN batch_item    bi ON bi.medicine_id    = m.medicine_id
LEFT JOIN stock_ledger sl ON sl.batch_item_id = bi.batch_item_id

-- FIX: Only alert on active medicines — no reorder needed for discontinued ones
WHERE m.is_active = TRUE

GROUP BY m.medicine_id, m.medicine_name, m.brand_name, m.category, m.reorder_level

-- Only include medicines at or below reorder threshold
HAVING COALESCE(SUM(sl.quantity_change), 0) <= m.reorder_level

ORDER BY total_stock ASC;


-- ============================================================
-- VIEW 4: vw_active_medicines  (FIX: new view)
-- Returns only active medicines for use in sale/batch dropdowns
-- Frontend should query this view, not the raw medicine table,
-- so discontinued medicines never appear as selectable options
-- ============================================================
CREATE OR REPLACE VIEW vw_active_medicines AS
SELECT
    medicine_id,
    medicine_name,
    brand_name,
    category,
    strength,
    reorder_level
FROM medicine
WHERE is_active = TRUE;


-- ============================================================
-- VIEW 5: vw_active_suppliers  (FIX: new view)
-- Returns only active suppliers for use in new batch dropdowns
-- Frontend should query this view, not the raw supplier table,
-- so deactivated suppliers never appear as selectable options
-- ============================================================
CREATE OR REPLACE VIEW vw_active_suppliers AS
SELECT
    supplier_id,
    supplier_name,
    phone,
    email,
    address
FROM supplier
WHERE is_active = TRUE;


SHOW FULL TABLES WHERE Table_type = 'VIEW';
