USE medical_inventory_db;

-- ============================================================
-- VIEW 1: vw_current_stock
-- Shows live stock for every received batch_item
-- stock = SUM of all quantity_change in stock_ledger
-- (purchases add, sales/damage/returns subtract)
-- expiry_status and stock_status used for dashboard alerts
-- ============================================================
CREATE OR REPLACE VIEW vw_current_stock AS
SELECT
    m.medicine_name,
    m.brand_name,
    m.category,
    m.strength,
    bi.batch_item_id,
    bi.expiry_date,
    bi.unit_price,
    b.batch_no,
    b.received_date,
    s.supplier_name,

    -- Live stock = sum of all ledger movements for this batch_item
    COALESCE(SUM(sl.quantity_change), 0)        AS current_stock,

    DATEDIFF(bi.expiry_date, CURDATE())         AS days_until_expiry,

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
    m.medicine_name, m.brand_name, m.category, m.strength,
    bi.batch_item_id, bi.expiry_date, bi.unit_price,
    b.batch_no, b.received_date, s.supplier_name, m.reorder_level;


-- ============================================================
-- VIEW 2: vw_expiry_alert
-- Shows only medicines expiring within 90 days
-- Excludes fully depleted stock (current_stock > 0)
-- Used for dashboard expiry warning panel
-- ============================================================
CREATE OR REPLACE VIEW vw_expiry_alert AS
SELECT
    m.medicine_name,
    m.brand_name,
    b.batch_no,
    s.supplier_name,
    bi.expiry_date,
    DATEDIFF(bi.expiry_date, CURDATE())         AS days_until_expiry,
    COALESCE(SUM(sl.quantity_change), 0)        AS current_stock,

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
    m.medicine_name, m.brand_name, b.batch_no,
    s.supplier_name, bi.expiry_date, bi.batch_item_id

-- Only show if stock still exists (no point alerting on empty stock)
HAVING COALESCE(SUM(sl.quantity_change), 0) > 0

ORDER BY bi.expiry_date ASC;


-- ============================================================
-- VIEW 3: vw_low_stock
-- Shows medicines at or below their reorder_level threshold
-- Aggregates across all batches for that medicine
-- Used for dashboard low stock / reorder panel
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

GROUP BY m.medicine_id, m.medicine_name, m.brand_name, m.category, m.reorder_level

-- Only include medicines at or below reorder threshold
HAVING COALESCE(SUM(sl.quantity_change), 0) <= m.reorder_level

ORDER BY total_stock ASC;


SHOW FULL TABLES WHERE Table_type = 'VIEW';
