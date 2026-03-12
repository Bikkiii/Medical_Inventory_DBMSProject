USE medical_inventory_db;

-- ============================================================
-- PROCEDURE 1: sp_process_sale
-- Processes a single medicine sale
-- FIX: Added check that medicine is_active = TRUE before selling
--      An inactive (discontinued) medicine must not be sold
-- CONCURRENCY: Transaction + FOR UPDATE lock on stock_ledger
-- Prevents two pharmacists selling the same stock simultaneously
-- The trigger trg_before_sale_item_insert also locks — but
-- locking here at procedure level gives earlier protection
-- Manual COMMIT/ROLLBACK for full control
-- ============================================================
DELIMITER $$

CREATE PROCEDURE sp_process_sale(
    IN p_customer_name  VARCHAR(100),
    IN p_customer_phone VARCHAR(20),
    IN p_served_by      INT,
    IN p_payment_mode   VARCHAR(20),
    IN p_batch_item_id  INT,
    IN p_medicine_id    INT,
    IN p_quantity_sold  INT,
    IN p_unit_price     DECIMAL(10,2),
    IN p_discount_pct   DECIMAL(5,2)
)
BEGIN
    DECLARE v_sale_id        INT;
    DECLARE v_subtotal       DECIMAL(10,2);
    DECLARE v_stock          INT;
    DECLARE v_medicine_active TINYINT DEFAULT 1;
    DECLARE v_error          TINYINT DEFAULT 0;

    -- Catch any SQL error and set flag for rollback
    DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_error = 1;

    SET v_subtotal = p_quantity_sold * p_unit_price * (1 - p_discount_pct / 100);

    -- FIX: Check medicine is still active before starting transaction
    -- Inactive = discontinued medicine, should not be sold
    SELECT is_active INTO v_medicine_active
    FROM medicine
    WHERE medicine_id = p_medicine_id;

    IF v_medicine_active = 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Sale failed: this medicine has been discontinued and cannot be sold.';
    END IF;

    START TRANSACTION;

        -- CONCURRENCY: Lock this batch_item's stock rows before checking
        -- Prevents another transaction from reading stale stock simultaneously
        SELECT COALESCE(SUM(quantity_change), 0)
        INTO   v_stock
        FROM   stock_ledger
        WHERE  batch_item_id = p_batch_item_id
        FOR UPDATE;

        -- Validate stock before proceeding
        IF v_stock < p_quantity_sold THEN
            SET v_error = 1;
        END IF;

        IF v_error = 0 THEN
            -- Create the sale header
            INSERT INTO sale (
                customer_name, customer_phone, served_by,
                total_amount, payment_mode, sale_status
            )
            VALUES (
                p_customer_name, p_customer_phone, p_served_by,
                v_subtotal, p_payment_mode, 'completed'
            );

            SET v_sale_id = LAST_INSERT_ID();

            -- Insert sale line item
            -- This fires trg_before_sale_item_insert (stock check + lock)
            -- and trg_after_sale_item_insert (stock deduction)
            INSERT INTO sale_item (
                sale_id, batch_item_id, medicine_id,
                quantity_sold, unit_price, discount_pct, subtotal
            )
            VALUES (
                v_sale_id, p_batch_item_id, p_medicine_id,
                p_quantity_sold, p_unit_price, p_discount_pct, v_subtotal
            );
        END IF;

    IF v_error = 1 THEN
        ROLLBACK;   -- Undo everything if any step failed
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Sale failed: insufficient stock or invalid data.';
    ELSE
        COMMIT;     -- Only commits if all steps succeeded
        SELECT v_sale_id AS created_sale_id;
    END IF;

END$$

DELIMITER ;


-- ============================================================
-- PROCEDURE 2: sp_process_return
-- Handles customer returns (wrong medicine, damaged, etc.)
-- Updates sale_status based on how much was returned
-- NOTE: Returns are allowed even if medicine is inactive
--       because the original sale already happened.
--       is_active only blocks NEW sales, not returns.
-- CONCURRENCY: Transaction ensures return record and
-- stock ledger update happen atomically
-- Manual COMMIT/ROLLBACK for full control
-- ============================================================
DELIMITER $$

CREATE PROCEDURE sp_process_return(
    IN p_sale_item_id      INT,
    IN p_quantity_returned INT,
    IN p_reason            VARCHAR(100),
    IN p_resolution        VARCHAR(50),
    IN p_processed_by      INT
)
BEGIN
    DECLARE v_batch_item_id INT;
    DECLARE v_medicine_id   INT;
    DECLARE v_unit_price    DECIMAL(10,2);
    DECLARE v_sale_id       INT;
    DECLARE v_refund_amount DECIMAL(10,2);
    DECLARE v_qty_sold      INT;
    DECLARE v_already_returned INT DEFAULT 0;
    DECLARE v_total_sold    INT DEFAULT 0;
    DECLARE v_total_returned INT DEFAULT 0;
    DECLARE v_total_requested INT DEFAULT 0;
    DECLARE v_error         TINYINT DEFAULT 0;

    DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_error = 1;

    -- Fetch sale_item details needed for the return record
    SELECT batch_item_id, medicine_id, unit_price, sale_id, quantity_sold
    INTO   v_batch_item_id, v_medicine_id, v_unit_price, v_sale_id, v_qty_sold
    FROM   sale_item
    WHERE  sale_item_id = p_sale_item_id;

    IF v_batch_item_id IS NULL THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Return failed: sale item not found.';
    END IF;

    -- Prevent invalid/over-limit returns
    IF p_quantity_returned <= 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Return failed: quantity_returned must be greater than 0.';
    END IF;

    IF p_resolution NOT IN ('refund', 'replacement', 'write_off', 'return_to_supplier', 'pending') THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Return failed: resolution must be refund, replacement, write_off, return_to_supplier, or pending.';
    END IF;

    SELECT COALESCE(SUM(quantity_returned), 0)
    INTO   v_already_returned
    FROM   `return`
    WHERE  sale_item_id = p_sale_item_id;

    IF p_quantity_returned > (v_qty_sold - v_already_returned) THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Return failed: quantity exceeds remaining sold amount.';
    END IF;

    -- Calculate refund only if resolution is 'refund'
    SET v_refund_amount = CASE
        WHEN p_resolution = 'refund' THEN p_quantity_returned * v_unit_price
        ELSE 0
    END;

    START TRANSACTION;

        -- Insert return record
        -- This fires trg_before_return_insert (stock lock + check)
        -- and trg_after_return_insert (stock adjustment)
        INSERT INTO `return` (
            return_type, sale_item_id, batch_item_id, medicine_id,
            quantity_returned, reason, damage_cause, resolution,
            refund_amount, processed_by
        ) VALUES (
            'customer_return', p_sale_item_id, v_batch_item_id, v_medicine_id,
            p_quantity_returned, p_reason, NULL, p_resolution,
            v_refund_amount, p_processed_by
        );

        -- Update sale_status based on total returned across the sale
        SELECT COALESCE(SUM(quantity_sold), 0)
        INTO v_total_sold
        FROM sale_item
        WHERE sale_id = v_sale_id;

        SELECT COALESCE(SUM(r.quantity_returned), 0)
        INTO v_total_requested
        FROM `return` r
        JOIN sale_item si ON si.sale_item_id = r.sale_item_id
        WHERE si.sale_id = v_sale_id;

        SELECT COALESCE(SUM(r.quantity_returned), 0)
        INTO v_total_returned
        FROM `return` r
        JOIN sale_item si ON si.sale_item_id = r.sale_item_id
        WHERE si.sale_id = v_sale_id AND r.resolution != 'pending';

        UPDATE sale
        SET sale_status = CASE
            WHEN v_total_requested <= 0 THEN 'completed'
            WHEN v_total_returned >= v_total_sold THEN 'fully_returned'
            ELSE 'partially_returned'
        END
        WHERE sale_id = v_sale_id;

    IF v_error = 1 THEN
        ROLLBACK;
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Return failed: invalid data or stock error.';
    ELSE
        COMMIT;
    END IF;

END$$

DELIMITER ;


-- ============================================================
-- PROCEDURE 3: sp_report_damage
-- Reports damaged or expired medicines (pre-sale damage)
-- Reduces stock via write_off or return_to_supplier resolution
-- NOTE: Damage reports are allowed even if medicine is inactive
--       because the stock physically exists and must be written off
-- CONCURRENCY: Transaction + trigger lock protects against
-- concurrent damage reports on the same batch_item
-- Manual COMMIT/ROLLBACK for full control
-- ============================================================
DELIMITER $$

CREATE PROCEDURE sp_report_damage(
    IN p_batch_item_id    INT,
    IN p_quantity_damaged INT,
    IN p_damage_cause     VARCHAR(100),
    IN p_resolution       VARCHAR(50),
    IN p_processed_by     INT
)
BEGIN
    DECLARE v_medicine_id INT;
    DECLARE v_error       TINYINT DEFAULT 0;

    DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_error = 1;

    -- Get medicine_id from batch_item
    SELECT medicine_id INTO v_medicine_id
    FROM   batch_item
    WHERE  batch_item_id = p_batch_item_id;

    START TRANSACTION;

        -- Insert damage report record
        -- This fires trg_before_return_insert (stock lock + check for write_off)
        -- and trg_after_return_insert (stock deduction)
        INSERT INTO `return` (
            return_type, sale_item_id, batch_item_id, medicine_id,
            quantity_returned, reason, damage_cause, resolution,
            refund_amount, processed_by
        ) VALUES (
            'damage_report', NULL, p_batch_item_id, v_medicine_id,
            p_quantity_damaged, 'damaged', p_damage_cause, p_resolution,
            NULL, p_processed_by
        );

    IF v_error = 1 THEN
        ROLLBACK;
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Damage report failed: quantity exceeds stock or invalid data.';
    ELSE
        COMMIT;
    END IF;

END$$

DELIMITER ;


-- ============================================================
-- PROCEDURE 4: sp_deactivate_supplier
-- FIX: Soft delete a supplier instead of hard deleting
-- Sets is_active = FALSE so supplier is hidden from new batch
-- dropdowns but all historical batch/return records are preserved
-- ============================================================
DELIMITER $$

CREATE PROCEDURE sp_deactivate_supplier(
    IN p_supplier_id INT
)
BEGIN
    DECLARE v_exists INT DEFAULT 0;

    SELECT COUNT(*) INTO v_exists
    FROM supplier
    WHERE supplier_id = p_supplier_id;

    IF v_exists = 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Deactivation failed: supplier not found.';
    END IF;

    UPDATE supplier
    SET is_active = FALSE
    WHERE supplier_id = p_supplier_id;

END$$

DELIMITER ;


-- ============================================================
-- PROCEDURE 5: sp_deactivate_medicine
-- FIX: Soft delete a medicine instead of hard deleting
-- Sets is_active = FALSE so medicine is hidden from new sale
-- dropdowns but all historical sale/return/ledger records are preserved
-- sp_process_sale checks is_active before allowing any new sale
-- ============================================================
DELIMITER $$

CREATE PROCEDURE sp_deactivate_medicine(
    IN p_medicine_id INT
)
BEGIN
    DECLARE v_exists INT DEFAULT 0;

    SELECT COUNT(*) INTO v_exists
    FROM medicine
    WHERE medicine_id = p_medicine_id;

    IF v_exists = 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Deactivation failed: medicine not found.';
    END IF;

    UPDATE medicine
    SET is_active = FALSE
    WHERE medicine_id = p_medicine_id;

END$$

DELIMITER ;

SHOW PROCEDURE STATUS WHERE Db = 'medical_inventory_db';
