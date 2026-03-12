-- ============================================================
-- Fresh demo data for medical_inventory_db
-- Safe to re-run: truncates all transactional tables first
-- ============================================================

USE medical_inventory_db;

SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE `return`;
TRUNCATE TABLE sale_item;
TRUNCATE TABLE sale;
TRUNCATE TABLE stock_ledger;
TRUNCATE TABLE batch_item;
TRUNCATE TABLE batch;
TRUNCATE TABLE medicine;
TRUNCATE TABLE category;
TRUNCATE TABLE supplier;
TRUNCATE TABLE user;
SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- 1. USERS  (password = "password123")
-- ============================================================
INSERT INTO user (full_name, username, password_hash, role, is_active) VALUES
('Admin User',      'aayush',       '$2b$10$KIX9FVtNsAF1YzT/NtJzPO3vVQlzY6eQkT1O5BmKqL7nRpWsGcIHu', 'admin',      TRUE),
('Admin User',      'bikash',       '$2b$10$KIX9FVtNsAF1YzT/NtJzPO3vVQlzY6eQkT1O5BmKqL7nRpWsGcIHu', 'admin',      TRUE),
('Brishav Pharmacist', 'brishav', '$2b$10$KIX9FVtNsAF1YzT/NtJzPO3vVQlzY6eQkT1O5BmKqL7nRpWsGcIHu', 'pharmacist', TRUE),
('Apoorva Pharmacist', 'Apoorva', '$2b$10$KIX9FVtNsAF1YzT/NtJzPO3vVQlzY6eQkT1O5BmKqL7nRpWsGcIHu', 'pharmacist', TRUE);

UPDATE user SET password_hash = '$2b$10$KIX9FVtNsAF1YzT/NtJzPO3vVQlzY6eQkT1O5BmKqL7nRpWsGcIHu' WHERE username = 'aayush';
UPDATE user SET password_hash = '$2b$10$KIX9FVtNsAF1YzT/NtJzPO3vVQlzY6eQkT1O5BmKqL7nRpWsGcIHu' WHERE username = 'bikash';
UPDATE user SET password_hash = '$2b$10$KIX9FVtNsAF1YzT/NtJzPO3vVQlzY6eQkT1O5BmKqL7nRpWsGcIHu' WHERE username = 'brishav';
UPDATE user SET password_hash = '$2b$10$KIX9FVtNsAF1YzT/NtJzPO3vVQlzY6eQkT1O5BmKqL7nRpWsGcIHu' WHERE username = 'apoorva';

-- ============================================================
-- 2. SUPPLIERS
-- ============================================================
INSERT INTO supplier (supplier_name, phone, email, address, is_active) VALUES
('MedSupply Co.',   '9800000001', 'contact@medsupply.com',  'Kathmandu, Nepal', TRUE),
('PharmaDist Ltd.', '9800000002', 'info@pharmadist.com',    'Lalitpur, Nepal',  TRUE),
('HealthSource Pvt.','9800000003','sales@healthsource.com', 'Bhaktapur, Nepal', TRUE);

-- ============================================================
-- 3. CATEGORIES
-- ============================================================
INSERT INTO category (name, description, is_active) VALUES
('antibiotic', 'Antibacterial medicines', TRUE),
('analgesic',  'Pain relievers', TRUE),
('antiviral',  'Antiviral medicines', TRUE),
('vitamin',    'Vitamins and supplements', TRUE),
('vaccine',    'Vaccines', TRUE),
('topical',    'Topical medicines', TRUE),
('other',      'Other or miscellaneous', TRUE);

-- ============================================================
-- 4. MEDICINES
-- ============================================================
INSERT INTO medicine (medicine_name, brand_name, category_id, strength, reorder_level, is_active) VALUES
('Amoxicillin',      'Amoxil',     1, '500mg',   120, TRUE),
('Paracetamol',      'Calpol',     2, '500mg',   200, TRUE),
('Ibuprofen',        'Brufen',     2, '400mg',   150, TRUE),
('Azithromycin',     'Zithromax',  1, '250mg',    80, TRUE),
('Oseltamivir',      'Tamiflu',    3, '75mg',     60, TRUE),
('Vitamin C',        'Celin',      4, '500mg',   180, TRUE),
('Hepatitis B',      'Engerix-B',  5, '20mcg',    40, TRUE),
('Clotrimazole',     'Canesten',   6, '1%',       60, TRUE),
('Metformin',        'Glucophage', 7, '500mg',   120, TRUE),
('Insulin Glargine', 'Lantus',     7, '100U/mL',  40, TRUE),
('Cetirizine',       'Cetzine',    7, '10mg',    100, TRUE);

-- ============================================================
-- 5. BATCHES
-- ============================================================
INSERT INTO batch (batch_no, supplier_id, received_by, received_date, invoice_no, invoice_amount, notes) VALUES
('BATCH-2026-101', 1, 1, '2026-01-10', 'INV-101', NULL, 'New year baseline stock'),
('BATCH-2026-102', 2, 2, '2026-02-05', 'INV-102', NULL, 'Seasonal flu restock'),
('BATCH-2026-103', 3, 2, '2026-02-25', 'INV-103', NULL, 'Chronic care supplies'),
('BATCH-2026-104', 1, 1, '2026-03-05', 'INV-104', NULL, 'Urgent top-up');

-- ============================================================
-- 6. BATCH ITEMS (stock ledger + invoice totals populated by triggers)
-- ============================================================
INSERT INTO batch_item (batch_id, medicine_id, quantity_received, manufacture_date, expiry_date, unit_price) VALUES
(1,  1, 200, '2025-06-01', '2026-04-01', 12.50),
(1,  2, 400, '2025-07-01', '2026-12-01',  4.00),
(1,  6, 300, '2025-05-15', '2026-03-01',  3.00),  -- expired
(2,  3, 180, '2025-08-01', '2026-08-01',  8.00),
(2,  4, 120, '2025-09-01', '2026-06-15', 18.00),
(2,  7,  40, '2025-10-01', '2027-01-01', 45.00),
(3,  8,  80, '2025-11-01', '2026-12-01', 14.00),
(3,  9, 150, '2025-11-15', '2026-05-01',  7.50),
(3, 10,  30, '2025-10-15', '2026-02-15', 90.00),  -- expired
(4,  2, 250, '2026-01-10', '2027-03-01',  4.20),
(4,  5,  60, '2026-01-05', '2026-07-01', 32.00),
(4, 11, 140, '2026-01-12', '2026-10-01',  4.00);

-- ============================================================
-- 7. SALES
-- ============================================================
INSERT INTO sale (sale_date, customer_name, customer_phone, served_by, total_amount, payment_mode, sale_status) VALUES
('2026-03-10 10:10:00', 'Ram Sharma',  '9811111111', 2, 560.00, 'cash', 'completed'),
('2026-03-11 12:20:00', 'Sita Thapa',  '9822222222', 3, 295.50, 'card', 'completed'),
('2026-03-11 16:00:00', 'Hari Bahadur','9833333333', 2, 290.00, 'upi',  'completed');

-- ============================================================
-- 8. SALE ITEMS
-- ============================================================
INSERT INTO sale_item (sale_id, batch_item_id, medicine_id, quantity_sold, unit_price, discount_pct, subtotal) VALUES
(1, 2, 2, 120,  4.00, 0.00, 480.00),
(1, 4, 3,  10,  8.00, 0.00,  80.00),
(2, 1, 1,  15, 12.50, 0.00, 187.50),
(2, 5, 4,   6, 18.00, 0.00, 108.00),
(3, 8, 9,  20,  7.50, 0.00, 150.00),
(3, 7, 8,  10, 14.00, 0.00, 140.00);

-- ============================================================
-- 9. RETURNS / DAMAGE REPORTS (use procedures to keep sale_status correct)
-- ============================================================
CALL sp_process_return(2, 2, 'Customer changed mind', 'refund', 2);
CALL sp_process_return(6, 4, 'Packaging torn', 'replacement', 3);
CALL sp_report_damage(3, 10, 'Expired on shelf', 'write_off', 1);

-- ============================================================
-- 10. QUICK CHECKS
-- ============================================================
SELECT 'USERS'        AS entity, COUNT(*) AS total FROM user;
SELECT 'SUPPLIERS'    AS entity, COUNT(*) AS total FROM supplier;
SELECT 'CATEGORIES'   AS entity, COUNT(*) AS total FROM category;
SELECT 'MEDICINES'    AS entity, COUNT(*) AS total FROM medicine;
SELECT 'BATCHES'      AS entity, COUNT(*) AS total FROM batch;
SELECT 'BATCH ITEMS'  AS entity, COUNT(*) AS total FROM batch_item;
SELECT 'STOCK LEDGER' AS entity, COUNT(*) AS total FROM stock_ledger;
SELECT 'SALES'        AS entity, COUNT(*) AS total FROM sale;
SELECT 'SALE ITEMS'   AS entity, COUNT(*) AS total FROM sale_item;
SELECT 'RETURNS'      AS entity, COUNT(*) AS total FROM `return`;
