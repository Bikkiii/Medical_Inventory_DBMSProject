DROP DATABASE IF EXISTS medical_inventory_db;
CREATE DATABASE medical_inventory_db;
USE medical_inventory_db;

CREATE TABLE user (
    user_id       INT          NOT NULL AUTO_INCREMENT,
    full_name     VARCHAR(100) NOT NULL,
    username      VARCHAR(50)  NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role          ENUM('admin','pharmacist') NOT NULL,
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id)
);

DESCRIBE user;

CREATE TABLE supplier (
    supplier_id   INT          NOT NULL AUTO_INCREMENT,
    supplier_name VARCHAR(150) NOT NULL,
    phone         VARCHAR(20)  NOT NULL,
    email         VARCHAR(100) NULL,
    address       TEXT         NULL,
    PRIMARY KEY (supplier_id)
);

describe supplier;

CREATE TABLE medicine (
    medicine_id   INT          NOT NULL AUTO_INCREMENT,
    medicine_name VARCHAR(150) NOT NULL,
    generic_name  VARCHAR(150) NULL,
    brand_name    VARCHAR(150) NULL,
    category      ENUM('antibiotic','analgesic','antiviral',
                       'vitamin','vaccine','topical','other') NOT NULL,
    form          ENUM('tablet','capsule','syrup','injection',
                       'ointment','drops','inhaler') NOT NULL,
    strength      VARCHAR(50)  NULL,
    unit          ENUM('strip','bottle','vial','tube','box') NOT NULL,
    reorder_level INT          NOT NULL DEFAULT 0,
    PRIMARY KEY (medicine_id)
);

describe medicine;

CREATE TABLE batch (
    batch_id       INT           NOT NULL AUTO_INCREMENT,
    batch_no       VARCHAR(20)   NOT NULL UNIQUE,
    supplier_id    INT           NOT NULL,
    ordered_by     INT           NOT NULL,
    received_by    INT           NULL,
    order_date     DATE          NOT NULL DEFAULT (CURRENT_DATE),
    received_date  DATE          NULL,
    invoice_no     VARCHAR(100)  NULL,
    invoice_amount DECIMAL(10,2) NULL,
    batch_status   ENUM('pending','received') NOT NULL DEFAULT 'pending',
    notes          TEXT          NULL,
    PRIMARY KEY (batch_id),
    CONSTRAINT fk_batch_supplier
        FOREIGN KEY (supplier_id) REFERENCES supplier(supplier_id),
    CONSTRAINT fk_batch_ordered_by
        FOREIGN KEY (ordered_by)  REFERENCES user(user_id),
    CONSTRAINT fk_batch_received_by
        FOREIGN KEY (received_by) REFERENCES user(user_id)
);

describe batch;

CREATE TABLE batch_item (
    batch_item_id     INT           NOT NULL AUTO_INCREMENT,
    batch_id          INT           NOT NULL,
    medicine_id       INT           NOT NULL,
    quantity_ordered  INT           NOT NULL,
    quantity_received INT           NOT NULL DEFAULT 0,
    manufacture_date  DATE          NOT NULL,
    expiry_date       DATE          NOT NULL,
    unit_price        DECIMAL(10,2) NOT NULL,
    PRIMARY KEY (batch_item_id),
    CONSTRAINT chk_batch_item_dates
        CHECK (expiry_date > manufacture_date),
    CONSTRAINT chk_quantity_received
        CHECK (quantity_received <= quantity_ordered),
    CONSTRAINT fk_batch_item_batch
        FOREIGN KEY (batch_id)    REFERENCES batch(batch_id),
    CONSTRAINT fk_batch_item_medicine
        FOREIGN KEY (medicine_id) REFERENCES medicine(medicine_id)
);

DESCRIBE batch_item;

CREATE TABLE stock_ledger (
    ledger_id        INT       NOT NULL AUTO_INCREMENT,
    medicine_id      INT       NOT NULL,
    batch_item_id    INT       NOT NULL,
    transaction_type ENUM('purchase','sale','return_in',
                          'return_out','damage_write_off',
                          'adjustment') NOT NULL,
    quantity_change  INT       NOT NULL,
    balance_after    INT       NOT NULL,
    reference_id     INT       NULL,
    transacted_by    INT       NOT NULL,
    transacted_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (ledger_id),
    CONSTRAINT chk_balance_non_negative
        CHECK (balance_after >= 0),
    CONSTRAINT fk_ledger_medicine
        FOREIGN KEY (medicine_id)   REFERENCES medicine(medicine_id),
    CONSTRAINT fk_ledger_batch_item
        FOREIGN KEY (batch_item_id) REFERENCES batch_item(batch_item_id),
    CONSTRAINT fk_ledger_user
        FOREIGN KEY (transacted_by) REFERENCES user(user_id)
);

describe stock_ledger;

CREATE TABLE sale (
    sale_id        INT           NOT NULL AUTO_INCREMENT,
    sale_date      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    customer_name  VARCHAR(100)  NOT NULL,
    customer_phone VARCHAR(20)   NULL,
    served_by      INT           NOT NULL,
    total_amount   DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    payment_mode   ENUM('cash','card','upi','insurance') NOT NULL,
    sale_status    ENUM('completed','partially_returned',
                        'fully_returned') NOT NULL DEFAULT 'completed',
    PRIMARY KEY (sale_id),
    CONSTRAINT fk_sale_user
        FOREIGN KEY (served_by) REFERENCES user(user_id)
);

DESCRIBE sale;

CREATE TABLE sale_item (
    sale_item_id  INT           NOT NULL AUTO_INCREMENT,
    sale_id       INT           NOT NULL,
    batch_item_id INT           NOT NULL,
    medicine_id   INT           NOT NULL,
    quantity_sold INT           NOT NULL,
    unit_price    DECIMAL(10,2) NOT NULL,
    discount_pct  DECIMAL(5,2)  NOT NULL DEFAULT 0.00,
    subtotal      DECIMAL(10,2) NOT NULL,
    PRIMARY KEY (sale_item_id),
    CONSTRAINT chk_quantity_sold
        CHECK (quantity_sold > 0),
    CONSTRAINT fk_sale_item_sale
        FOREIGN KEY (sale_id)       REFERENCES sale(sale_id),
    CONSTRAINT fk_sale_item_batch_item
        FOREIGN KEY (batch_item_id) REFERENCES batch_item(batch_item_id),
    CONSTRAINT fk_sale_item_medicine
        FOREIGN KEY (medicine_id)   REFERENCES medicine(medicine_id)
);

DESCRIBE sale_item;

CREATE TABLE `return` (
    return_id           INT           NOT NULL AUTO_INCREMENT,
    return_type         ENUM('customer_return','damage_report',
                             'supplier_return') NOT NULL,
    return_date         TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sale_item_id        INT           NULL,
    batch_item_id       INT           NOT NULL,
    medicine_id         INT           NOT NULL,
    quantity_returned   INT           NOT NULL,
    reason              ENUM('wrong_medicine','damaged','expired',
                             'side_effect','other') NOT NULL,
    damage_cause        ENUM('transit','storage','expiry',
                             'handling','other') NULL,
    resolution          ENUM('refund','replacement','write_off',
                             'return_to_supplier','pending')
                        NOT NULL DEFAULT 'pending',
    replacement_sale_id INT           NULL,
    refund_amount       DECIMAL(10,2) NULL,
    processed_by        INT           NOT NULL,
    PRIMARY KEY (return_id),
    CONSTRAINT chk_quantity_returned
        CHECK (quantity_returned > 0),
    CONSTRAINT fk_return_sale_item
        FOREIGN KEY (sale_item_id)        REFERENCES sale_item(sale_item_id),
    CONSTRAINT fk_return_batch_item
        FOREIGN KEY (batch_item_id)       REFERENCES batch_item(batch_item_id),
    CONSTRAINT fk_return_medicine
        FOREIGN KEY (medicine_id)         REFERENCES medicine(medicine_id),
    CONSTRAINT fk_return_replacement_sale
        FOREIGN KEY (replacement_sale_id) REFERENCES sale(sale_id),
    CONSTRAINT fk_return_processed_by
        FOREIGN KEY (processed_by)        REFERENCES user(user_id)
);

DESCRIBE `return`;

show tables;