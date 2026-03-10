-- TRIGGER 1 — Auto-populate stock when batch is received

DELIMITER $$

CREATE TRIGGER trg_after_batch_received
AFTER UPDATE ON batch
FOR EACH ROW
BEGIN
    IF NEW.batch_status = 'received' AND OLD.batch_status != 'received' THEN
        INSERT INTO stock_ledger (
            medicine_id, batch_item_id, transaction_type,
            quantity_change, balance_after, reference_id,
            transacted_by, transacted_at
        )
        SELECT
            bi.medicine_id,
            bi.batch_item_id,
            'purchase',
            bi.quantity_received,
            COALESCE((
                SELECT SUM(sl.quantity_change)
                FROM stock_ledger sl
                WHERE sl.batch_item_id = bi.batch_item_id
            ), 0) + bi.quantity_received,
            NEW.batch_id,
            NEW.received_by,
            NOW()
        FROM batch_item bi
        WHERE bi.batch_id = NEW.batch_id;
    END IF;
END$$

DELIMITER ;
SHOW TRIGGERS;


-- TRIGGER 2 — Block sale if not enough stock

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


-- TRIGGER 3 — Deduct stock after sale

DELIMITER $$

CREATE TRIGGER trg_after_sale_item_insert
AFTER INSERT ON sale_item
FOR EACH ROW
BEGIN
    INSERT INTO stock_ledger (
        medicine_id, batch_item_id, transaction_type,
        quantity_change, balance_after, reference_id,
        transacted_by, transacted_at
    )
    SELECT
        NEW.medicine_id,
        NEW.batch_item_id,
        'sale',
        -NEW.quantity_sold,
        COALESCE((
            SELECT SUM(sl.quantity_change)
            FROM stock_ledger sl
            WHERE sl.batch_item_id = NEW.batch_item_id
        ), 0) - NEW.quantity_sold,
        NEW.sale_id,
        s.served_by,
        NOW()
    FROM sale s
    WHERE s.sale_id = NEW.sale_id;
END$$

DELIMITER ;


-- TRIGGER 4 — Block return/damage if stock insufficient
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


-- TRIGGER 5 — Update stock after return
DELIMITER $$

CREATE TRIGGER trg_after_return_insert
AFTER INSERT ON `return`
FOR EACH ROW
BEGIN
    INSERT INTO stock_ledger (
        medicine_id, batch_item_id, transaction_type,
        quantity_change, balance_after, reference_id,
        transacted_by, transacted_at
    )
    SELECT
        NEW.medicine_id,
        NEW.batch_item_id,
        CASE
            WHEN NEW.return_type = 'customer_return'
                 AND NEW.resolution IN ('refund','replacement') THEN 'return_in'
            WHEN NEW.return_type = 'damage_report'
                 AND NEW.resolution = 'write_off'              THEN 'damage_write_off'
            WHEN NEW.return_type = 'supplier_return'
                 OR  NEW.resolution = 'return_to_supplier'     THEN 'return_out'
        END,
        CASE
            WHEN NEW.return_type = 'customer_return'
                 AND NEW.resolution IN ('refund','replacement') THEN  NEW.quantity_returned
            WHEN NEW.return_type = 'damage_report'
                 AND NEW.resolution = 'write_off'              THEN -NEW.quantity_returned
            WHEN NEW.return_type = 'supplier_return'
                 OR  NEW.resolution = 'return_to_supplier'     THEN -NEW.quantity_returned
        END,
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
        NEW.return_id,
        NEW.processed_by,
        NOW()
    FROM DUAL
    WHERE NEW.resolution != 'pending';
END$$

DELIMITER ;


-- TRIGGER 6 & 7 — Auto-calculate invoice amount
DELIMITER //

CREATE TRIGGER trg_after_insert_batch_item
AFTER INSERT ON batch_item
FOR EACH ROW
BEGIN
    UPDATE batch
    SET invoice_amount = COALESCE(invoice_amount, 0) + (NEW.quantity_ordered * NEW.unit_price)
    WHERE batch_id = NEW.batch_id;
END //

CREATE TRIGGER trg_after_delete_batch_item
AFTER DELETE ON batch_item
FOR EACH ROW
BEGIN
    UPDATE batch
    SET invoice_amount = invoice_amount - (OLD.quantity_ordered * OLD.unit_price)
    WHERE batch_id = OLD.batch_id;
END //

DELIMITER ;

show triggers;
