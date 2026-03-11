USE medical_inventory_db;

-- ============================================================
-- PROCEDURE 1: sp_process_sale
-- Processes a single medicine sale
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
    DECLARE v_sale_id      INT;
    DECLARE v_subtotal     DECIMAL(10,2);
    DECLARE v_stock        INT;
    DECLARE v_error        TINYINT DEFAULT 0;

    -- Catch any SQL error and set flag for rollback
    DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_error = 1;

    SET v_subtotal = p_quantity_sold * p_unit_price * (1 - p_discount_pct / 100);

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
    DECLARE v_error         TINYINT DEFAULT 0;

    DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_error = 1;

    -- Fetch sale_item details needed for the return record
    SELECT batch_item_id, medicine_id, unit_price, sale_id, quantity_sold
    INTO   v_batch_item_id, v_medicine_id, v_unit_price, v_sale_id, v_qty_sold
    FROM   sale_item
    WHERE  sale_item_id = p_sale_item_id;

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

        -- Update sale_status based on how much was returned
        -- fully_returned if all items returned, otherwise partially_returned
        UPDATE sale
        SET sale_status = CASE
            WHEN v_qty_sold = p_quantity_returned THEN 'fully_returned'
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

SHOW PROCEDURE STATUS WHERE Db = 'medical_inventory_db';
