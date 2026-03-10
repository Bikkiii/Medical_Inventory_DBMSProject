-- TEST A SALE
-- Sell 5 Paracetamol from Batch 1 (batch_item_id = 1)
CALL sp_process_sale(
    'Ram Sharma',    -- customer name
    '9800000001',   -- phone
    2,              -- served by (Anita = user_id 2)
    'cash',         -- payment
    1,              -- batch_item_id (Paracetamol from BCH-0001)
    1,              -- medicine_id
    5,              -- quantity
    3.50,           -- unit price
    0.00            -- discount
);

-- Check stock reduced from 200 to 195
SELECT medicine_name, batch_no, current_stock
FROM vw_current_stock
WHERE medicine_name = 'Paracetamol 500mg';

-- Check stock_ledger has a 'sale' entry
SELECT * FROM stock_ledger ORDER BY ledger_id DESC LIMIT 3;

-- Check sale was created
SELECT * FROM sale;
SELECT * FROM sale_item;


-- TEST A RETURN
-- Customer returns 2 Paracetamol (sale_item_id = 1)
CALL sp_process_return(
    1,               -- sale_item_id
    2,               -- quantity returned
    'wrong_medicine',-- reason
    'refund',        -- resolution
    2                -- processed by Anita
);

-- Check stock went back up (195 + 2 = 197)
SELECT medicine_name, batch_no, current_stock
FROM vw_current_stock
WHERE medicine_name = 'Paracetamol 500mg';

-- Check return record created
SELECT * FROM `return`;

-- Check sale status changed to partially_returned
SELECT sale_id, sale_status FROM sale WHERE sale_id = 1;

-- Check stock_ledger has 'return_in' entry
SELECT * FROM stock_ledger ORDER BY ledger_id DESC LIMIT 3;

-- TEST A DAMAGE WRITE-OFF
-- Write off 10 damaged Betadine bottles (batch_item_id = 9)
CALL sp_report_damage(
    12,          -- batch_item_id (Betadine)
    10,         -- quantity damaged
    'storage',  -- damage cause
    'write_off',-- resolution
    2           -- processed by aayush
);

-- Stock should reduce from 50 to 40
SELECT medicine_name, batch_no, current_stock
FROM vw_current_stock
WHERE medicine_name = 'Betadine Solution';

-- Check stock_ledger has 'damage_write_off' entry
SELECT * FROM stock_ledger ORDER BY ledger_id DESC LIMIT 3;



-- PHASE 13: Final Check — Full Audit Trail
SELECT
    sl.ledger_id,
    m.medicine_name,
    b.batch_no,
    sl.transaction_type,
    sl.quantity_change,
    sl.balance_after,
    u.full_name     AS done_by,
    sl.transacted_at
FROM stock_ledger sl
JOIN medicine   m  ON m.medicine_id    = sl.medicine_id
JOIN batch_item bi ON bi.batch_item_id = sl.batch_item_id
JOIN batch      b  ON b.batch_id       = bi.batch_id
JOIN user       u  ON u.user_id        = sl.transacted_by
ORDER BY sl.ledger_id ASC;
