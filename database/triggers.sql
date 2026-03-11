USE medical_inventory_db;

-- ============================================================
-- TRIGGER 1: trg_after_batch_item_insert
-- Fires when a batch_item is inserted (medicines received)
-- Automatically adds a 'purchase' entry to stock_ledger
-- No ordering concept — stock is added immediately on entry
-- ============================================================
DELIMITER $$

CREATE TRIGGER trg_after_batch_item_insert
AFTER INSERT ON batch_item
FOR EACH ROW
BEGIN
    -- Get who entered this batch (received_by from batch table)
    DECLARE v_received_by INT;

    SELECT received_by INTO v_received_by
    FROM batch
    WHERE batch_id = NEW.batch_id;

    -- Insert stock ledger entry for this medicine
    -- balance_after = previous balance + quantity just received
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
        -- Calculate running balance for this batch_item
        -- COALESCE handles first entry (no previous ledger rows)
        COALESCE((
            SELECT SUM(quantity_change)
            FROM stock_ledger
            WHERE batch_item_id = NEW.batch_item_id
        ), 0) + NEW.quantity_received,
        NEW.batch_id,       -- reference_id points to batch
        v_received_by,
        NOW()
    );
END$$

DELIMITER ;


-- ============================================================
-- TRIGGER 2: trg_after_insert_batch_item_invoice
-- Fires when a batch_item is inserted
-- Auto-calculates and updates invoice_amount on the batch
-- ============================================================
DELIMITER $$

CREATE TRIGGER trg_after_insert_batch_item_invoice
AFTER INSERT ON batch_item
FOR EACH ROW
BEGIN
    -- Add this item's cost to the batch invoice total
    UPDATE batch
    SET invoice_amount = COALESCE(invoice_amount, 0) + (NEW.quantity_received * NEW.unit_price)
    WHERE batch_id = NEW.batch_id;
END$$

DELIMITER ;


-- ============================================================
-- TRIGGER 3: trg_after_delete_batch_item_invoice
-- Fires when a batch_item is deleted
-- Recalculates invoice_amount on the batch
-- ============================================================
DELIMITER $$

CREATE TRIGGER trg_after_delete_batch_item_invoice
AFTER DELETE ON batch_item
FOR EACH ROW
BEGIN
    -- Subtract deleted item's cost from the batch invoice total
    UPDATE batch
    SET invoice_amount = invoice_amount - (OLD.quantity_received * OLD.unit_price)
    WHERE batch_id = OLD.batch_id;
END$$

DELIMITER ;


-- ============================================================
-- TRIGGER 4: trg_before_sale_item_insert
-- Fires BEFORE a sale_item is inserted
-- CONCURRENCY: Uses FOR UPDATE to lock stock_ledger rows
-- This prevents two pharmacists from selling the same stock
-- simultaneously (race condition protection)
-- Blocks the sale if stock is insufficient
-- ============================================================
DELIMITER $$

CREATE TRIGGER trg_before_sale_item_insert
BEFORE INSERT ON sale_item
FOR EACH ROW
BEGIN
    DECLARE v_current_stock INT;

    -- FOR UPDATE locks the rows so no other transaction
    -- can read/modify this batch_item's stock until we commit
    SELECT COALESCE(SUM(quantity_change), 0)
    INTO   v_current_stock
    FROM   stock_ledger
    WHERE  batch_item_id = NEW.batch_item_id
    FOR UPDATE;

    -- Block the sale if not enough stock
    IF NEW.quantity_sold > v_current_stock THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Insufficient stock for this batch item.';
    END IF;
END$$

DELIMITER ;


-- ============================================================
-- TRIGGER 5: trg_after_sale_item_insert
-- Fires AFTER a sale_item is inserted
-- Deducts stock from ledger (negative quantity_change)
-- ============================================================
DELIMITER $$

CREATE TRIGGER trg_after_sale_item_insert
AFTER INSERT ON sale_item
FOR EACH ROW
BEGIN
    -- Insert a 'sale' ledger entry with negative quantity (stock out)
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
    SELECT
        NEW.medicine_id,
        NEW.batch_item_id,
        'sale',
        -NEW.quantity_sold,                 -- negative = stock going out
        COALESCE((
            SELECT SUM(sl.quantity_change)
            FROM stock_ledger sl
            WHERE sl.batch_item_id = NEW.batch_item_id
        ), 0) - NEW.quantity_sold,          -- new balance after deduction
        NEW.sale_id,                        -- reference_id points to sale
        s.served_by,
        NOW()
    FROM sale s
    WHERE s.sale_id = NEW.sale_id;
END$$

DELIMITER ;


-- ============================================================
-- TRIGGER 6: trg_before_return_insert
-- Fires BEFORE a return is inserted
-- CONCURRENCY: Uses FOR UPDATE to lock stock_ledger rows
-- Only applies for write_off and return_to_supplier
-- (these reduce stock — must check availability first)
-- ============================================================
DELIMITER $$

CREATE TRIGGER trg_before_return_insert
BEFORE INSERT ON `return`
FOR EACH ROW
BEGIN
    DECLARE v_current_stock INT;

    -- Only check stock for resolutions that reduce stock
    IF NEW.resolution IN ('write_off', 'return_to_supplier') THEN

        -- Lock rows to prevent concurrent stock reduction
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
-- Fires AFTER a return is inserted
-- Updates stock based on return_type and resolution:
--   customer_return + refund/replacement → return_in  (stock UP)
--   damage_report   + write_off          → damage_write_off (stock DOWN)
--   supplier_return / return_to_supplier → return_out (stock DOWN)
--   resolution = pending                 → NO stock movement
-- ============================================================
DELIMITER $$

CREATE TRIGGER trg_after_return_insert
AFTER INSERT ON `return`
FOR EACH ROW
BEGIN
    -- pending resolution means decision not made yet — skip stock movement
    IF NEW.resolution != 'pending' THEN
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
        SELECT
            NEW.medicine_id,
            NEW.batch_item_id,

            -- Determine transaction type based on return_type + resolution
            CASE
                WHEN NEW.return_type = 'customer_return'
                     AND NEW.resolution IN ('refund','replacement') THEN 'return_in'
                WHEN NEW.return_type = 'damage_report'
                     AND NEW.resolution = 'write_off'              THEN 'damage_write_off'
                WHEN NEW.return_type = 'supplier_return'
                     OR  NEW.resolution = 'return_to_supplier'     THEN 'return_out'
            END,

            -- Determine quantity direction (positive = stock in, negative = stock out)
            CASE
                WHEN NEW.return_type = 'customer_return'
                     AND NEW.resolution IN ('refund','replacement') THEN  NEW.quantity_returned
                WHEN NEW.return_type = 'damage_report'
                     AND NEW.resolution = 'write_off'              THEN -NEW.quantity_returned
                WHEN NEW.return_type = 'supplier_return'
                     OR  NEW.resolution = 'return_to_supplier'     THEN -NEW.quantity_returned
            END,

            -- Calculate new balance
            COALESCE((
                SELECT SUM(sl.quantity_change)
                FROM stock_ledger sl
                WHERE sl.batch_item_id = NEW.batch_item_id
            ), 0) +
            CASE
                WHEN NEW.return_type = 'customer_return'
                     AND NEW.resolution IN ('refund','replacement') THEN  NEW.quantity_returned
                WHEN NEW.return_type = 'damage_report'
                     AND NEW.resolution = 'write_off'              THEN -NEW.quantity_returned
                WHEN NEW.return_type = 'supplier_return'
                     OR  NEW.resolution = 'return_to_supplier'     THEN -NEW.quantity_returned
            END,

            NEW.return_id,          -- reference_id points to return
            NEW.processed_by,
            NOW()
        FROM DUAL;
    END IF;
END$$

DELIMITER ;

SHOW TRIGGERS;
