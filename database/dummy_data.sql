-- Users
INSERT INTO user (full_name, username, password_hash, role) VALUES
('Admin User',     'admin', 'admin123', 'admin'),
('Aayush Chhuka', 'aayush', 'aayush123', 'pharmacist'),
('Bikash Dhami',   'bikash', 'bikash123', 'pharmacist'),
('Brishav Joshi',   'brishav', 'brishav123', 'pharmacist');

SELECT * FROM user;

-- supplier
INSERT INTO supplier (supplier_name, phone, email, address) VALUES
('MedCo Pharmaceuticals', '9801000001', 'medco@example.com',  'Baneshwor, Kathmandu'),
('PharmX Distributors',   '9801000002', 'pharmx@example.com', 'Putalisadak, Kathmandu'),
('Nepal Drug House',      '9801000003', 'ndh@example.com',    'New Baneshwor, Kathmandu');

SELECT * FROM supplier;

-- medicine
INSERT INTO medicine (medicine_name, generic_name, brand_name, category, form, strength, unit, reorder_level) VALUES
('Paracetamol 500mg',  'Acetaminophen',    'Panadol',    'analgesic',  'tablet',  '500mg', 'strip',  20),
('Amoxicillin 250mg',  'Amoxicillin',      'Amoxil',     'antibiotic', 'capsule', '250mg', 'strip',  15),
('Vitamin C 500mg',    'Ascorbic Acid',    'Celin',      'vitamin',    'tablet',  '500mg', 'strip',  25),
('Azithromycin 500mg', 'Azithromycin',     'Zithromax',  'antibiotic', 'tablet',  '500mg', 'strip',  10),
('ORS Sachet',         'Oral Rehydration', 'Electral',   'other',      'syrup',   '21g',   'box',    30),
('Cetirizine 10mg',    'Cetirizine',       'Zyrtec',     'analgesic',  'tablet',  '10mg',  'strip',  20),
('Metformin 500mg',    'Metformin HCl',    'Glucophage', 'other',      'tablet',  '500mg', 'strip',  15),
('Betadine Solution',  'Povidone Iodine',  'Betadine',   'topical',    'ointment','10%',   'bottle', 10);

SELECT * FROM medicine;

-- Insert Batches and See Triggers Fire 
-- Batch 1
-- Insert batch header
INSERT INTO batch (batch_no, supplier_id, ordered_by, order_date, invoice_no, batch_status)
VALUES ('BCH-2026-0001', 1, 1, '2026-01-10', 'INV-MC-001', 'pending');

-- Insert medicines inside this batch
INSERT INTO batch_item (batch_id, medicine_id, quantity_ordered, quantity_received, manufacture_date, expiry_date, unit_price)
VALUES
(1, 1, 200, 200, '2025-01-01', '2027-01-01', 3.50),
(1, 2, 100, 100, '2025-03-01', '2026-09-01', 8.00),
(1, 3, 150, 150, '2025-02-01', '2027-02-01', 4.00);

-- Check invoice_amount was auto-calculated by trigger
SELECT batch_no, invoice_amount FROM batch WHERE batch_id = 1;
-- Expected: 200×3.50 + 100×8.00 + 150×4.00 = 700 + 800 + 600 = 2100.00

-- Mark batch as received (triggers stock_ledger entries)
CALL sp_receive_batch(1, 2, '2026-01-12');
-- See stock_ledger — should now have 3 rows (one per medicine)
SELECT * FROM stock_ledger;
-- See current stock view — data should now appear
SELECT * FROM vw_current_stock;


-- Batch 2
INSERT INTO batch (batch_no, supplier_id, ordered_by, order_date, invoice_no, batch_status)
VALUES ('BCH-2026-0002', 2, 1, '2026-01-20', 'INV-PX-002', 'pending');

INSERT INTO batch_item (batch_id, medicine_id, quantity_ordered, quantity_received, manufacture_date, expiry_date, unit_price)
VALUES
(2, 4,  80,  80, '2025-06-01', '2027-06-01', 12.00),
(2, 5, 200, 200, '2025-08-01', '2026-08-01',  5.00),
(2, 6, 120, 120, '2025-05-01', '2027-05-01',  4.50),
(2, 7, 100, 100, '2025-04-01', '2027-04-01',  6.00);

CALL sp_receive_batch(2, 3, '2026-01-22');

SELECT * FROM stock_ledger;
-- Should now have 7 rows total


-- Batch 3 (Near-expiry Betadine for alert testing)
INSERT INTO batch (batch_no, supplier_id, ordered_by, order_date, invoice_no, batch_status)
VALUES ('BCH-2026-0003', 3, 1, '2026-02-01', 'INV-NDH-003', 'pending');

INSERT INTO batch_item (batch_id, medicine_id, quantity_ordered, quantity_received, manufacture_date, expiry_date, unit_price)
VALUES
(3, 8,  50,  50, '2024-06-01', '2026-03-30', 45.00),
(3, 1, 100, 100, '2025-10-01', '2027-10-01',  3.50);

CALL sp_receive_batch(3, 2, '2026-02-03');

-- Now check expiry alert — Betadine should appear
SELECT * FROM vw_expiry_alert;
