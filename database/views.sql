-- VIEW 1 — Current Stock

CREATE OR REPLACE VIEW vw_current_stock AS
SELECT
    m.medicine_name,
    bi.batch_item_id,
    bi.expiry_date,
    bi.unit_price,
    b.batch_no,
    s.supplier_name,
    COALESCE(SUM(sl.quantity_change), 0) AS current_stock,
    DATEDIFF(bi.expiry_date, CURDATE())  AS days_until_expiry,
    CASE
        WHEN bi.expiry_date < CURDATE()                        THEN 'expired'
        WHEN DATEDIFF(bi.expiry_date, CURDATE()) <= 30         THEN 'expiring_30_days'
        WHEN DATEDIFF(bi.expiry_date, CURDATE()) <= 60         THEN 'expiring_60_days'
        WHEN DATEDIFF(bi.expiry_date, CURDATE()) <= 90         THEN 'expiring_90_days'
        ELSE 'ok'
    END AS expiry_status,
    CASE
        WHEN COALESCE(SUM(sl.quantity_change), 0) <= 0              THEN 'out_of_stock'
        WHEN COALESCE(SUM(sl.quantity_change), 0) <= m.reorder_level THEN 'low_stock'
        ELSE 'ok'
    END AS stock_status
FROM batch_item bi
JOIN medicine      m  ON m.medicine_id  = bi.medicine_id
JOIN batch         b  ON b.batch_id     = bi.batch_id
JOIN supplier      s  ON s.supplier_id  = b.supplier_id
LEFT JOIN stock_ledger sl ON sl.batch_item_id = bi.batch_item_id
WHERE b.batch_status = 'received'
GROUP BY m.medicine_name, bi.batch_item_id, bi.expiry_date,
         bi.unit_price, b.batch_no, s.supplier_name, m.reorder_level;
         
SELECT * FROM vw_current_stock;
-- Empty for now, will show data after seed

-- VIEW 2 — Expiry Alert
CREATE OR REPLACE VIEW vw_expiry_alert AS
SELECT
    m.medicine_name,
    b.batch_no,
    s.supplier_name,
    bi.expiry_date,
    DATEDIFF(bi.expiry_date, CURDATE())  AS days_until_expiry,
    COALESCE(SUM(sl.quantity_change), 0) AS current_stock,
    CASE
        WHEN bi.expiry_date < CURDATE()                        THEN 'EXPIRED'
        WHEN DATEDIFF(bi.expiry_date, CURDATE()) <= 30         THEN 'EXPIRING IN 30 DAYS'
        WHEN DATEDIFF(bi.expiry_date, CURDATE()) <= 60         THEN 'EXPIRING IN 60 DAYS'
        WHEN DATEDIFF(bi.expiry_date, CURDATE()) <= 90         THEN 'EXPIRING IN 90 DAYS'
    END AS alert_level
FROM batch_item bi
JOIN medicine      m  ON m.medicine_id  = bi.medicine_id
JOIN batch         b  ON b.batch_id     = bi.batch_id
JOIN supplier      s  ON s.supplier_id  = b.supplier_id
LEFT JOIN stock_ledger sl ON sl.batch_item_id = bi.batch_item_id
WHERE b.batch_status = 'received'
  AND bi.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 90 DAY)
GROUP BY m.medicine_name, b.batch_no, s.supplier_name,
         bi.expiry_date, bi.batch_item_id
HAVING COALESCE(SUM(sl.quantity_change), 0) > 0
ORDER BY bi.expiry_date ASC;


-- VIEW 3 — Low Stock
CREATE OR REPLACE VIEW vw_low_stock AS
SELECT
    m.medicine_name,
    m.reorder_level,
    COALESCE(SUM(sl.quantity_change), 0) AS total_stock,
    m.reorder_level - COALESCE(SUM(sl.quantity_change), 0) AS shortage_quantity,
    CASE
        WHEN COALESCE(SUM(sl.quantity_change), 0) <= 0              THEN 'OUT OF STOCK'
        WHEN COALESCE(SUM(sl.quantity_change), 0) <= m.reorder_level THEN 'LOW STOCK'
    END AS stock_alert
FROM medicine m
JOIN batch_item    bi ON bi.medicine_id    = m.medicine_id
JOIN batch         b  ON b.batch_id        = bi.batch_id
LEFT JOIN stock_ledger sl ON sl.batch_item_id = bi.batch_item_id
WHERE b.batch_status = 'received'
GROUP BY m.medicine_id, m.medicine_name, m.reorder_level
HAVING COALESCE(SUM(sl.quantity_change), 0) <= m.reorder_level
ORDER BY total_stock ASC;

SHOW FULL TABLES WHERE Table_type = 'VIEW';