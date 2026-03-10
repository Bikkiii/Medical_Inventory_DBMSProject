-- PROCEDURE 1 — Receive Batch
DELIMITER $$

CREATE PROCEDURE sp_receive_batch(
    IN p_batch_id      INT,
    IN p_received_by   INT,
    IN p_received_date DATE
)
BEGIN
    UPDATE batch
    SET batch_status  = 'received',
        received_by   = p_received_by,
        received_date = p_received_date
    WHERE batch_id     = p_batch_id
    AND   batch_status = 'pending';
END$$

DELIMITER ;

-- PROCEDURE 2 — Process Sale
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
    DECLARE v_sale_id  INT;
    DECLARE v_subtotal DECIMAL(10,2);
    DECLARE v_error    TINYINT DEFAULT 0;
    DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_error = 1;

    SET v_subtotal = p_quantity_sold * p_unit_price * (1 - p_discount_pct / 100);

    START TRANSACTION;
        INSERT INTO sale (customer_name, customer_phone, served_by,
                          total_amount, payment_mode, sale_status)
        VALUES (p_customer_name, p_customer_phone, p_served_by,
                v_subtotal, p_payment_mode, 'completed');

        SET v_sale_id = LAST_INSERT_ID();

        INSERT INTO sale_item (sale_id, batch_item_id, medicine_id,
                               quantity_sold, unit_price, discount_pct, subtotal)
        VALUES (v_sale_id, p_batch_item_id, p_medicine_id,
                p_quantity_sold, p_unit_price, p_discount_pct, v_subtotal);

    IF v_error = 1 THEN
        ROLLBACK;
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Sale failed: insufficient stock or invalid data.';
    ELSE
        COMMIT;
        SELECT v_sale_id AS created_sale_id;
    END IF;
END$$

DELIMITER ;

-- PROCEDURE 3 — Process Return
DELIMITER $$

CREATE PROCEDURE sp_process_return(
    IN p_sale_item_id      INT,
    IN p_quantity_returned INT,
    IN p_reason            VARCHAR(50),
    IN p_resolution        VARCHAR(50),
    IN p_processed_by      INT
)
BEGIN
    DECLARE v_batch_item_id INT;
    DECLARE v_medicine_id   INT;
    DECLARE v_unit_price    DECIMAL(10,2);
    DECLARE v_sale_id       INT;
    DECLARE v_refund_amount DECIMAL(10,2);
    DECLARE v_error         TINYINT DEFAULT 0;
    DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_error = 1;

    SELECT batch_item_id, medicine_id, unit_price, sale_id
    INTO   v_batch_item_id, v_medicine_id, v_unit_price, v_sale_id
    FROM   sale_item
    WHERE  sale_item_id = p_sale_item_id;

    SET v_refund_amount = CASE
        WHEN p_resolution = 'refund' THEN p_quantity_returned * v_unit_price
        ELSE 0
    END;

    START TRANSACTION;
        INSERT INTO `return` (
            return_type, sale_item_id, batch_item_id, medicine_id,
            quantity_returned, reason, damage_cause, resolution,
            refund_amount, processed_by
        ) VALUES (
            'customer_return', p_sale_item_id, v_batch_item_id, v_medicine_id,
            p_quantity_returned, p_reason, NULL, p_resolution,
            v_refund_amount, p_processed_by
        );

        UPDATE sale
        SET sale_status = CASE
            WHEN (SELECT SUM(quantity_sold) FROM sale_item WHERE sale_id = v_sale_id)
                 = p_quantity_returned THEN 'fully_returned'
            ELSE 'partially_returned'
        END
        WHERE sale_id = v_sale_id;

    IF v_error = 1 THEN
        ROLLBACK;
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Return failed.';
    ELSE
        COMMIT;
    END IF;
END$$

DELIMITER ;

-- PROCEDURE 4 — Report Damage
DELIMITER $$

CREATE PROCEDURE sp_report_damage(
    IN p_batch_item_id    INT,
    IN p_quantity_damaged INT,
    IN p_damage_cause     VARCHAR(20),
    IN p_resolution       VARCHAR(30),
    IN p_processed_by     INT
)
BEGIN
    DECLARE v_medicine_id INT;
    DECLARE v_error       TINYINT DEFAULT 0;
    DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_error = 1;

    SELECT medicine_id INTO v_medicine_id
    FROM   batch_item
    WHERE  batch_item_id = p_batch_item_id;

    START TRANSACTION;
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
        SET MESSAGE_TEXT = 'Damage report failed: quantity exceeds stock.';
    ELSE
        COMMIT;
    END IF;
END$$

DELIMITER ;

SHOW PROCEDURE STATUS WHERE Db = 'medical_inventory_db';