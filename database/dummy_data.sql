-- ============================================================
-- dummy_data.sql
-- Complete dummy data for medical_inventory_db
-- Assumes schema.sql, triggers.sql, views.sql, procedures.sql
-- have already been sourced via main.sql
--
-- ID MAP (auto_increment — insertion order matters):
-- -------------------------------------------------------
-- user:        1=admin, 2=john_pharma, 3=sara_pharma, 4=old_admin
-- supplier:    1=MedSupply, 2=PharmaDist, 3=HealthSource, 4=GlobalMed
-- medicine:    1=Amoxicillin, 2=Paracetamol, 3=Ibuprofen, 4=Azithromycin
--              5=Oseltamivir, 6=VitaminC, 7=HepB, 8=Clotrimazole
--              9=Metformin, 10=Insulin
-- batch:       1=BATCH-2025-001(sup1), 2=BATCH-2025-002(sup2)
--              3=BATCH-2025-003(sup3), 4=BATCH-2025-004(sup1)
--              5=BATCH-2025-005(sup4)
-- batch_item:  1=Amox(b1),  2=Para(b1),  3=Ibup(b2),  4=VitC(b2)
--              5=Clot(b2),  6=Azith(b3), 7=Osel(b3),  8=Para(b4)
--              9=Metf(b4),  10=HepB(b5), 11=Insu(b5)
-- sale:        1=Ram, 2=Sita, 3=Hari, 4=Gita, 5=Bikash
-- sale_item:   1=Ram-Amox,  2=Sita-Ibup, 3=Sita-VitC
--              4=Hari-Para, 5=Hari-Clot, 6=Gita-Azith, 7=Bikash-Osel
-- return:      1=Hari partial refund(si4)
--              2=Bikash full replacement(si7)
--              3=VitC damage write_off(no sale)
--              4=Clot supplier_return(no sale)
--              5=Sita Ibup pending(si2)
-- ============================================================

USE medical_inventory_db;

-- ============================================================
-- 1. USERS
-- password_hash = bcrypt of 'password123' (testing only)
-- ============================================================
INSERT INTO user (full_name, username, password_hash, role, is_active) VALUES
-- user_id=1
('Admin User',      'admin',       '$2b$10$KIX9FVtNsAF1YzT/NtJzPO3vVQlzY6eQkT1O5BmKqL7nRpWsGcIHu', 'admin',      TRUE),
-- user_id=2
('John Pharmacist', 'john_pharma', '$2b$10$KIX9FVtNsAF1YzT/NtJzPO3vVQlzY6eQkT1O5BmKqL7nRpWsGcIHu', 'pharmacist', TRUE),
-- user_id=3
('Sara Pharmacist', 'sara_pharma', '$2b$10$KIX9FVtNsAF1YzT/NtJzPO3vVQlzY6eQkT1O5BmKqL7nRpWsGcIHu', 'pharmacist', TRUE),
-- user_id=4
('Old Admin',       'old_admin',   '$2b$10$KIX9FVtNsAF1YzT/NtJzPO3vVQlzY6eQkT1O5BmKqL7nRpWsGcIHu', 'admin',      FALSE);

-- ============================================================
-- 2. SUPPLIERS
-- ============================================================
INSERT INTO supplier (supplier_name, phone, email, address) VALUES
-- supplier_id=1
('MedSupply Co.',     '9800000001', 'contact@medsupply.com',  'Kathmandu, Nepal'),
-- supplier_id=2
('PharmaDist Ltd.',   '9800000002', 'info@pharmadist.com',    'Lalitpur, Nepal'),
-- supplier_id=3
('HealthSource Pvt.', '9800000003', 'sales@healthsource.com', 'Bhaktapur, Nepal'),
-- supplier_id=4
('GlobalMed Imports', '9800000004', NULL,                      'Pokhara, Nepal');

-- ============================================================
-- 3. MEDICINES
-- category ENUM: 'antibiotic' | 'analgesic' | 'antiviral'
--                'vitamin' | 'vaccine' | 'topical' | 'other'
-- ============================================================
INSERT INTO medicine (medicine_name, brand_name, category, strength, reorder_level) VALUES
-- medicine_id=1
('Amoxicillin',      'Amoxil',     'antibiotic', '500mg',   100),
-- medicine_id=2
('Paracetamol',      'Calpol',     'analgesic',  '500mg',   150),
-- medicine_id=3
('Ibuprofen',        'Brufen',     'analgesic',  '400mg',   100),
-- medicine_id=4
('Azithromycin',     'Zithromax',  'antibiotic', '250mg',    80),
-- medicine_id=5
('Oseltamivir',      'Tamiflu',    'antiviral',  '75mg',     50),
-- medicine_id=6
('Vitamin C',        'Celin',      'vitamin',    '500mg',   200),
-- medicine_id=7
('Hepatitis B',      'Engerix-B',  'vaccine',    '20mcg',    30),
-- medicine_id=8
('Clotrimazole',     'Canesten',   'topical',    '1%',       60),
-- medicine_id=9
('Metformin',        'Glucophage', 'other',      '500mg',   120),
-- medicine_id=10
('Insulin Glargine', 'Lantus',     'other',      '100U/mL',  40);

-- ============================================================
-- 4. BATCHES
-- invoice_amount = NULL — trigger auto-calculates it per batch_item
-- received_by: 1=admin, 2=john_pharma
-- ============================================================
INSERT INTO batch (batch_no, supplier_id, received_by, received_date, invoice_no, invoice_amount, notes) VALUES
-- batch_id=1
('BATCH-2025-001', 1, 1, '2025-01-10', 'INV-1001', NULL, 'First batch of the year'),
-- batch_id=2
('BATCH-2025-002', 2, 1, '2025-01-20', 'INV-2001', NULL, 'Refrigerated items included'),
-- batch_id=3
('BATCH-2025-003', 3, 2, '2025-02-05', 'INV-3001', NULL, NULL),
-- batch_id=4
('BATCH-2025-004', 1, 2, '2025-02-18', 'INV-1002', NULL, 'Urgent restock'),
-- batch_id=5
('BATCH-2025-005', 4, 1, '2025-03-01', 'INV-4001', NULL, 'Vaccine batch — cold chain maintained');

-- ============================================================
-- 5. BATCH ITEMS
-- Triggers fired per INSERT:
--   trg_after_batch_item_insert         → writes 'purchase' to stock_ledger
--   trg_after_insert_batch_item_invoice → adds cost to batch.invoice_amount
-- Constraints:
--   expiry_date > manufacture_date  (CHECK)
--   quantity_received > 0           (CHECK)
-- ============================================================

-- BATCH 1 (batch_id=1) — MedSupply | received by admin
INSERT INTO batch_item (batch_id, medicine_id, quantity_received, manufacture_date, expiry_date, unit_price) VALUES
-- batch_item_id=1 | Amoxicillin | stock → 300
(1, 1, 300, '2024-06-01', '2026-06-01', 12.50),
-- batch_item_id=2 | Paracetamol | stock → 500
(1, 2, 500, '2024-07-01', '2026-07-01',  5.00);
-- invoice_amount batch_1 = (300×12.50)+(500×5.00) = 3750+2500 = 6250.00

-- BATCH 2 (batch_id=2) — PharmaDist | received by admin
INSERT INTO batch_item (batch_id, medicine_id, quantity_received, manufacture_date, expiry_date, unit_price) VALUES
-- batch_item_id=3 | Ibuprofen    | stock → 200
(2, 3, 200, '2024-08-01', '2026-08-01',  8.00),
-- batch_item_id=4 | Vitamin C    | stock → 400
(2, 6, 400, '2024-09-01', '2026-09-01',  3.50),
-- batch_item_id=5 | Clotrimazole | stock → 150
(2, 8, 150, '2024-08-15', '2026-08-15', 15.00);
-- invoice_amount batch_2 = (200×8)+(400×3.5)+(150×15) = 1600+1400+2250 = 5250.00

-- BATCH 3 (batch_id=3) — HealthSource | received by john_pharma
INSERT INTO batch_item (batch_id, medicine_id, quantity_received, manufacture_date, expiry_date, unit_price) VALUES
-- batch_item_id=6 | Azithromycin | stock → 180
(3, 4, 180, '2024-10-01', '2026-10-01', 18.00),
-- batch_item_id=7 | Oseltamivir  | stock → 80
(3, 5,  80, '2024-10-01', '2026-10-01', 35.00);
-- invoice_amount batch_3 = (180×18)+(80×35) = 3240+2800 = 6040.00

-- BATCH 4 (batch_id=4) — MedSupply | received by john_pharma
-- Paracetamol expiry=2025-04-10 → ~30 days from 2025-03-11
-- → appears in vw_expiry_alert as 'EXPIRING IN 30 DAYS'
INSERT INTO batch_item (batch_id, medicine_id, quantity_received, manufacture_date, expiry_date, unit_price) VALUES
-- batch_item_id=8 | Paracetamol (expiring soon) | stock → 60
(4, 2,  60, '2024-01-01', '2025-04-10',  5.00),
-- batch_item_id=9 | Metformin | stock → 250
(4, 9, 250, '2024-11-01', '2026-11-01',  7.50);
-- invoice_amount batch_4 = (60×5)+(250×7.5) = 300+1875 = 2175.00

-- BATCH 5 (batch_id=5) — GlobalMed | received by admin
-- Insulin 30 units, reorder_level=40 → appears in vw_low_stock
INSERT INTO batch_item (batch_id, medicine_id, quantity_received, manufacture_date, expiry_date, unit_price) VALUES
-- batch_item_id=10 | Hepatitis B vaccine | stock → 50
(5, 7,  50, '2024-12-01', '2026-12-01', 45.00),
-- batch_item_id=11 | Insulin Glargine (below reorder) | stock → 30
(5, 10, 30, '2024-12-01', '2026-12-01', 95.00);
-- invoice_amount batch_5 = (50×45)+(30×95) = 2250+2850 = 5100.00

-- ============================================================
-- STOCK LEDGER AFTER ALL PURCHASES (11 'purchase' rows auto-inserted by trigger):
-- bi_id | medicine          | stock
--  1    | Amoxicillin       |  300
--  2    | Paracetamol       |  500
--  3    | Ibuprofen         |  200
--  4    | Vitamin C         |  400
--  5    | Clotrimazole      |  150
--  6    | Azithromycin      |  180
--  7    | Oseltamivir       |   80
--  8    | Paracetamol(exp)  |   60
--  9    | Metformin         |  250
-- 10    | Hepatitis B       |   50
-- 11    | Insulin Glargine  |   30
-- ============================================================

-- ============================================================
-- 6. SALES
-- total_amount manually matches sale_items subtotals below
-- sale_status set to final state directly for dummy consistency
-- served_by: 2=john_pharma, 3=sara_pharma
-- ============================================================
INSERT INTO sale (customer_name, customer_phone, served_by, total_amount, payment_mode, sale_status) VALUES
-- sale_id=1
('Ram Sharma',    '9811111111', 2,  125.00, 'cash',      'completed'),
-- sale_id=2
('Sita Thapa',    '9822222222', 3,  190.00, 'card',      'completed'),
-- sale_id=3
('Hari Bahadur',  '9833333333', 2,   87.50, 'upi',       'partially_returned'),
-- sale_id=4
('Gita Rai',      '9844444444', 3,   70.08, 'cash',      'completed'),
-- sale_id=5
('Bikash Gurung', '9855555555', 2,  190.00, 'insurance', 'fully_returned');

-- ============================================================
-- 7. SALE ITEMS
-- Triggers fired per INSERT:
--   trg_before_sale_item_insert → checks stock (FOR UPDATE lock)
--   trg_after_sale_item_insert  → deducts stock in stock_ledger
-- subtotal = quantity_sold × unit_price × (1 − discount_pct/100)
-- ============================================================

-- sale_id=1 | Ram | Amoxicillin
-- bi_id=1, stock: 300 → 290
INSERT INTO sale_item (sale_id, batch_item_id, medicine_id, quantity_sold, unit_price, discount_pct, subtotal) VALUES
-- sale_item_id=1
(1, 1, 1, 10, 12.50, 0.00, 125.00);

-- sale_id=2 | Sita | Ibuprofen + Vitamin C
-- bi_id=3, stock: 200 → 185
-- bi_id=4, stock: 400 → 380
INSERT INTO sale_item (sale_id, batch_item_id, medicine_id, quantity_sold, unit_price, discount_pct, subtotal) VALUES
-- sale_item_id=2
(2, 3, 3, 15, 8.00, 0.00, 120.00),
-- sale_item_id=3
(2, 4, 6, 20, 3.50, 0.00,  70.00);

-- sale_id=3 | Hari | Paracetamol + Clotrimazole (50% disc)
-- bi_id=2, stock: 500 → 490
-- bi_id=5, stock: 150 → 145
INSERT INTO sale_item (sale_id, batch_item_id, medicine_id, quantity_sold, unit_price, discount_pct, subtotal) VALUES
-- sale_item_id=4
(3, 2, 2, 10,  5.00,  0.00, 50.00),
-- sale_item_id=5
(3, 5, 8,  5, 15.00, 50.00, 37.50);

-- sale_id=4 | Gita | Azithromycin (2.78% disc)
-- bi_id=6, stock: 180 → 176
-- subtotal = 4 × 18.00 × 0.9722 = 70.08
INSERT INTO sale_item (sale_id, batch_item_id, medicine_id, quantity_sold, unit_price, discount_pct, subtotal) VALUES
-- sale_item_id=6
(4, 6, 4, 4, 18.00, 2.78, 70.08);

-- sale_id=5 | Bikash | Oseltamivir (will be fully returned)
-- bi_id=7, stock: 80 → 78
INSERT INTO sale_item (sale_id, batch_item_id, medicine_id, quantity_sold, unit_price, discount_pct, subtotal) VALUES
-- sale_item_id=7
(5, 7, 5, 2, 95.00, 0.00, 190.00);

-- ============================================================
-- STOCK AFTER ALL SALES:
-- bi_id | medicine          | stock
--  1    | Amoxicillin       |  290  (300-10)
--  2    | Paracetamol       |  490  (500-10)
--  3    | Ibuprofen         |  185  (200-15)
--  4    | Vitamin C         |  380  (400-20)
--  5    | Clotrimazole      |  145  (150-5)
--  6    | Azithromycin      |  176  (180-4)
--  7    | Oseltamivir       |   78  (80-2)
--  8    | Paracetamol(exp)  |   60  (unsold)
--  9    | Metformin         |  250  (unsold)
-- 10    | Hepatitis B       |   50  (unsold)
-- 11    | Insulin Glargine  |   30  (unsold)
-- ============================================================

-- ============================================================
-- 8. RETURNS
-- Triggers fired per INSERT:
--   trg_before_return_insert → locks stock for write_off/return_to_supplier
--   trg_after_return_insert  → adjusts stock_ledger per resolution
-- ============================================================

-- return_id=1 | Hari returned 5 Paracetamol | refund
-- sale_item_id=4, bi_id=2
-- resolution=refund → return_in → stock: 490+5=495
INSERT INTO `return` (return_type, sale_item_id, batch_item_id, medicine_id, quantity_returned, reason, damage_cause, resolution, refund_amount, processed_by) VALUES
('customer_return', 4, 2, 2, 5, 'Excess quantity purchased', NULL, 'refund', 25.00, 2);

-- return_id=2 | Bikash returned 2 Oseltamivir | replacement
-- sale_item_id=7, bi_id=7
-- resolution=replacement → return_in → stock: 78+2=80
INSERT INTO `return` (return_type, sale_item_id, batch_item_id, medicine_id, quantity_returned, reason, damage_cause, resolution, refund_amount, processed_by) VALUES
('customer_return', 7, 7, 5, 2, 'Wrong medicine dispensed', NULL, 'replacement', NULL, 3);

-- return_id=3 | Damage: 10 Vitamin C water damaged | write_off
-- sale_item_id=NULL (not from a sale)
-- bi_id=4, resolution=write_off → damage_write_off → stock: 380-10=370
INSERT INTO `return` (return_type, sale_item_id, batch_item_id, medicine_id, quantity_returned, reason, damage_cause, resolution, refund_amount, processed_by) VALUES
('damage_report', NULL, 4, 6, 10, 'damaged', 'Water leakage in storage room', 'write_off', NULL, 1);

-- return_id=4 | Supplier return: 5 Clotrimazole | return_to_supplier
-- sale_item_id=NULL (not from a sale)
-- bi_id=5, resolution=return_to_supplier → return_out → stock: 145-5=140
INSERT INTO `return` (return_type, sale_item_id, batch_item_id, medicine_id, quantity_returned, reason, damage_cause, resolution, refund_amount, processed_by) VALUES
('supplier_return', NULL, 5, 8, 5, 'Packaging defect reported', 'Torn seal on tubes', 'return_to_supplier', NULL, 1);

-- return_id=5 | Sita returned 3 Ibuprofen | pending (no stock movement)
-- sale_item_id=2, bi_id=3
-- resolution=pending → NO stock_ledger entry
INSERT INTO `return` (return_type, sale_item_id, batch_item_id, medicine_id, quantity_returned, reason, damage_cause, resolution, refund_amount, processed_by) VALUES
('customer_return', 2, 3, 3, 3, 'Allergic reaction reported', NULL, 'pending', NULL, 3);

-- ============================================================
-- FINAL STOCK AFTER ALL RETURNS:
-- bi_id | medicine          | stock
--  1    | Amoxicillin       |  290
--  2    | Paracetamol       |  495  (+5 refund)
--  3    | Ibuprofen         |  185  (pending — no change)
--  4    | Vitamin C         |  370  (-10 write_off)
--  5    | Clotrimazole      |  140  (-5 return_to_supplier)
--  6    | Azithromycin      |  176
--  7    | Oseltamivir       |   80  (+2 replacement)
--  8    | Paracetamol(exp)  |   60  → expiry alert
--  9    | Metformin         |  250
-- 10    | Hepatitis B       |   50
-- 11    | Insulin Glargine  |   30  → low stock (reorder=40)
-- ============================================================

-- ============================================================
-- VERIFY
-- ============================================================
SELECT 'USERS'        AS entity, COUNT(*) AS total FROM user;
SELECT 'SUPPLIERS'    AS entity, COUNT(*) AS total FROM supplier;
SELECT 'MEDICINES'    AS entity, COUNT(*) AS total FROM medicine;
SELECT 'BATCHES'      AS entity, COUNT(*) AS total FROM batch;
SELECT 'BATCH ITEMS'  AS entity, COUNT(*) AS total FROM batch_item;
SELECT 'STOCK LEDGER' AS entity, COUNT(*) AS total FROM stock_ledger;
SELECT 'SALES'        AS entity, COUNT(*) AS total FROM sale;
SELECT 'SALE ITEMS'   AS entity, COUNT(*) AS total FROM sale_item;
SELECT 'RETURNS'      AS entity, COUNT(*) AS total FROM `return`;

-- Invoice amounts auto-set by trigger
SELECT batch_id, batch_no, invoice_amount FROM batch ORDER BY batch_id;

-- Full ledger trail
SELECT sl.ledger_id, m.medicine_name, sl.transaction_type,
       sl.quantity_change, sl.balance_after, sl.transacted_at
FROM stock_ledger sl
JOIN medicine m ON m.medicine_id = sl.medicine_id
ORDER BY sl.ledger_id;

-- Live stock per batch_item
SELECT medicine_name, batch_no, current_stock, expiry_status, stock_status
FROM vw_current_stock
ORDER BY medicine_name;

-- Expiry alerts (within 90 days)
SELECT medicine_name, batch_no, days_until_expiry, current_stock, alert_level
FROM vw_expiry_alert;

-- Low stock alerts
SELECT medicine_name, total_stock, reorder_level, shortage_quantity, stock_alert
FROM vw_low_stock;