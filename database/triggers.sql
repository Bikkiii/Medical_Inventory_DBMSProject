-- USE medical_inventory_db;

-- ============================================================
-- Drop existing triggers before recreating
-- ============================================================
DROP TRIGGER IF EXISTS trg_after_batch_item_insert;
DROP TRIGGER IF EXISTS trg_after_insert_batch_item_invoice;
DROP TRIGGER IF EXISTS trg_after_delete_batch_item_invoice;
DROP TRIGGER IF EXISTS trg_before_sale_item_insert;
DROP TRIGGER IF EXISTS trg_after_sale_item_insert;
DROP TRIGGER IF EXISTS trg_before_return_insert;
DROP TRIGGER IF EXISTS trg_after_return_insert;


-- ============================================================
-- TRIGGER 1: trg_after_batch_item_insert
-- FIX: fetch SUM into v_prev_balance variable first,
--      then use variable in INSERT VALUES.
--      MySQL error 1093 occurs when you SELECT from the same
--      table you are inserting into inside the same statement.
--      Using a variable breaks the self-reference.
-- ============================================================
DELIMITER $$

CREATE TRIGGER trg_after_batch_item_insert
AFTER INSERT ON batch_item
FOR EACH ROW
BEGIN
    DECLARE v_received_by  INT;
    DECLARE v_prev_balance INT DEFAULT 0;

    -- Who entered this batch
    SELECT received_by INTO v_received_by
    FROM batch
    WHERE batch_id = NEW.batch_id;

    -- FIX: fetch previous balance into variable BEFORE the INSERT
    SELECT COALESCE(SUM(quantity_change), 0)
    INTO   v_prev_balance
    FROM   stock_ledger
    WHERE  batch_item_id = NEW.batch_item_id;

    -- Now INSERT using the variable — no self-referencing subquery
    INSERT INTO stock_ledger (
        medicine_id,
        batch_item_id,
        transaction_type,
        quantity_change,
        balance_after,
        reference_id,
        transacted_by,
        transacted_at
    )
    VALUES (
        NEW.medicine_id,
        NEW.batch_item_id,
        'purchase',
        NEW.quantity_received,
        v_prev_balance + NEW.quantity_received,  -- variable used here
        NEW.batch_id,
        v_received_by,
        NOW()
    );
END$$

DELIMITER ;


-- ============================================================
-- TRIGGER 2: trg_after_insert_batch_item_invoice
-- No change needed — no self-referencing subquery here
-- ============================================================
DELIMITER $$

CREATE TRIGGER trg_after_insert_batch_item_invoice
AFTER INSERT ON batch_item
FOR EACH ROW
BEGIN
    UPDATE batch
    SET invoice_amount = COALESCE(invoice_amount, 0) + (NEW.quantity_received * NEW.unit_price)
    WHERE batch_id = NEW.batch_id;
END$$

DELIMITER ;


-- ============================================================
-- TRIGGER 3: trg_after_delete_batch_item_invoice
-- No change needed — no self-referencing subquery here
-- ============================================================
DELIMITER $$

CREATE TRIGGER trg_after_delete_batch_item_invoice
AFTER DELETE ON batch_item
FOR EACH ROW
BEGIN
    UPDATE batch
    SET invoice_amount = invoice_amount - (OLD.quantity_received * OLD.unit_price)
    WHERE batch_id = OLD.batch_id;
END$$

DELIMITER ;


-- ============================================================
-- TRIGGER 4: trg_before_sale_item_insert
-- No change needed — SELECT into variable is fine in BEFORE trigger
-- (not inserting into stock_ledger here, only reading)
-- ============================================================
DELIMITER $$

CREATE TRIGGER trg_before_sale_item_insert
BEFORE INSERT ON sale_item
FOR EACH ROW
BEGIN
    DECLARE v_current_stock INT;

    SELECT COALESCE(SUM(quantity_change), 0)
    INTO   v_current_stock
    FROM   stock_ledger
    WHERE  batch_item_id = NEW.batch_item_id
    FOR UPDATE;

    IF NEW.quantity_sold > v_current_stock THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Insufficient stock for this batch item.';
    END IF;
END$$

DELIMITER ;


-- ============================================================
-- TRIGGER 5: trg_after_sale_item_insert
-- FIX: fetch SUM into v_prev_balance variable first,
--      then use variable in INSERT SELECT.
--      The nested subquery on stock_ledger inside a
--      stock_ledger INSERT caused error 1093.
-- ============================================================
DELIMITER $$

CREATE TRIGGER trg_after_sale_item_insert
AFTER INSERT ON sale_item
FOR EACH ROW
BEGIN
    DECLARE v_served_by    INT;
    DECLARE v_prev_balance INT DEFAULT 0;

    -- Who served this sale
    SELECT served_by INTO v_served_by
    FROM sale
    WHERE sale_id = NEW.sale_id;

    -- FIX: fetch previous balance into variable BEFORE the INSERT
    SELECT COALESCE(SUM(quantity_change), 0)
    INTO   v_prev_balance
    FROM   stock_ledger
    WHERE  batch_item_id = NEW.batch_item_id;

    -- INSERT using variable — no self-referencing subquery
    INSERT INTO stock_ledger (
        medicine_id,
        batch_item_id,
        transaction_type,
        quantity_change,
        balance_after,
        reference_id,
        transacted_by,
        transacted_at
    )
    VALUES (
        NEW.medicine_id,
        NEW.batch_item_id,
        'sale',
        -NEW.quantity_sold,
        v_prev_balance - NEW.quantity_sold,   -- variable used here
        NEW.sale_id,
        v_served_by,
        NOW()
    );
END$$

DELIMITER ;


-- ============================================================
-- TRIGGER 6: trg_before_return_insert
-- No change needed — SELECT into variable is fine in BEFORE trigger
-- ============================================================
DELIMITER $$

CREATE TRIGGER trg_before_return_insert
BEFORE INSERT ON `return`
FOR EACH ROW
BEGIN
    DECLARE v_current_stock INT;

    IF NEW.resolution IN ('write_off', 'return_to_supplier') THEN

        SELECT COALESCE(SUM(quantity_change), 0)
        INTO   v_current_stock
        FROM   stock_ledger
        WHERE  batch_item_id = NEW.batch_item_id
        FOR UPDATE;

        IF NEW.quantity_returned > v_current_stock THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Cannot process: quantity exceeds available stock.';
        END IF;

    END IF;
END$$

DELIMITER ;


-- ============================================================
-- TRIGGER 7: trg_after_return_insert
-- FIX: fetch SUM into v_prev_balance variable first,
--      then calculate v_qty_change and v_balance_after,
--      then use variables in INSERT VALUES.
--      Same error 1093 fix as triggers 1 and 5.
-- ============================================================
DELIMITER $$

CREATE TRIGGER trg_after_return_insert
AFTER INSERT ON `return`
FOR EACH ROW
BEGIN
    DECLARE v_prev_balance  INT DEFAULT 0;
    DECLARE v_qty_change    INT DEFAULT 0;
    DECLARE v_balance_after INT DEFAULT 0;
    DECLARE v_txn_type      VARCHAR(20);

    IF NEW.resolution != 'pending' THEN

        -- FIX: fetch previous balance into variable BEFORE the INSERT
        SELECT COALESCE(SUM(quantity_change), 0)
        INTO   v_prev_balance
        FROM   stock_ledger
        WHERE  batch_item_id = NEW.batch_item_id;

        -- Determine transaction type
        IF NEW.return_type = 'customer_return'
           AND NEW.resolution IN ('refund', 'replacement') THEN
            SET v_txn_type   = 'return_in';
            SET v_qty_change = NEW.quantity_returned;          -- stock UP

        ELSEIF NEW.return_type = 'damage_report'
               AND NEW.resolution = 'write_off' THEN
            SET v_txn_type   = 'damage_write_off';
            SET v_qty_change = -NEW.quantity_returned;         -- stock DOWN

        ELSEIF NEW.return_type = 'supplier_return'
               OR NEW.resolution = 'return_to_supplier' THEN
            SET v_txn_type   = 'return_out';
            SET v_qty_change = -NEW.quantity_returned;         -- stock DOWN
        END IF;

        SET v_balance_after = v_prev_balance + v_qty_change;

        -- INSERT using variables — no self-referencing subquery
        INSERT INTO stock_ledger (
            medicine_id,
            batch_item_id,
            transaction_type,
            quantity_change,
            balance_after,
            reference_id,
            transacted_by,
            transacted_at
        )
        VALUES (
            NEW.medicine_id,
            NEW.batch_item_id,
            v_txn_type,
            v_qty_change,
            v_balance_after,
            NEW.return_id,
            NEW.processed_by,
            NOW()
        );

    END IF;
END$$

DELIMITER ;