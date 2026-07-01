DROP DATABASE IF EXISTS auction_db;

UPDATE Users SET role = 'admin' WHERE username = 'admin123';
CREATE DATABASE IF NOT EXISTS auction_db
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE auction_db;

SET FOREIGN_KEY_CHECKS = 0;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE Users (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    username        VARCHAR(50)  NOT NULL UNIQUE,
    email           VARCHAR(100) NOT NULL UNIQUE,
    password        VARCHAR(255) NOT NULL,

    role            ENUM('user', 'admin') DEFAULT 'user' NOT NULL,
    account_status  ENUM('active', 'locked') DEFAULT 'active' NOT NULL,

    balance         DECIMAL(15,2) DEFAULT 0.00 NOT NULL,

    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_users_role (role),
    INDEX idx_users_status (account_status),
    INDEX idx_users_email (email)
);

CREATE TABLE Products (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    category    VARCHAR(100),
    image_url   LONGTEXT,

    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_products_category (category),
    INDEX idx_products_created_at (created_at DESC)
);

CREATE TABLE Auctions (
    id                  INT AUTO_INCREMENT PRIMARY KEY,

    product_id          INT NOT NULL,
    created_by          INT NOT NULL,

    status              ENUM(
        'Pending',
        'Rejected',
        'Scheduled',
        'Active',
        'Closing',
        'Ended',
        'Payment Pending',
        'Completed',
        'Cancelled'
    ) DEFAULT 'Pending' NOT NULL,

    current_price       DECIMAL(15,2) NOT NULL,
    step_price          DECIMAL(15,2) NOT NULL,

    requires_deposit    BOOLEAN DEFAULT TRUE NOT NULL,
    deposit_amount      DECIMAL(15,2) DEFAULT 0.00 NOT NULL,

    start_time          DATETIME NULL,
    end_time            DATETIME NOT NULL,

    winner_id           INT NULL,
    final_price         DECIMAL(15,2) NULL,
    payment_due_at      DATETIME NULL,

    approved_by         INT NULL,
    approved_at         DATETIME NULL,

    rejected_by         INT NULL,
    rejected_at         DATETIME NULL,
    rejection_reason    TEXT NULL,

    cancelled_by        INT NULL,
    cancelled_at        DATETIME NULL,
    cancellation_reason TEXT NULL,

    stripe_session_id   VARCHAR(255) UNIQUE,
    version             INT DEFAULT 0 NOT NULL,

    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (product_id)   REFERENCES Products(id) ON DELETE RESTRICT,
    FOREIGN KEY (created_by)   REFERENCES Users(id)    ON DELETE RESTRICT,
    FOREIGN KEY (winner_id)    REFERENCES Users(id)    ON DELETE SET NULL,
    FOREIGN KEY (approved_by)  REFERENCES Users(id)    ON DELETE SET NULL,
    FOREIGN KEY (rejected_by)  REFERENCES Users(id)    ON DELETE SET NULL,
    FOREIGN KEY (cancelled_by) REFERENCES Users(id)    ON DELETE SET NULL,

    INDEX idx_auctions_status_time (status, start_time, end_time),
    INDEX idx_auctions_created_by (created_by),
    INDEX idx_auctions_product_id (product_id),
    INDEX idx_auctions_winner (winner_id),
    INDEX idx_auctions_approved_by (approved_by),
    INDEX idx_auctions_created_at (created_at DESC)
);

CREATE TABLE Bids (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    auction_id INT NOT NULL,
    user_id    INT NOT NULL,
    bid_amount DECIMAL(15,2) NOT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (auction_id) REFERENCES Auctions(id) ON DELETE RESTRICT,
    FOREIGN KEY (user_id)    REFERENCES Users(id)    ON DELETE RESTRICT,

    INDEX idx_bids_auction_time (auction_id, created_at DESC),
    INDEX idx_bids_auction_user (auction_id, user_id),
    INDEX idx_bids_user_time (user_id, created_at DESC)
);

CREATE TABLE AutoBids (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    auction_id INT NOT NULL,
    user_id    INT NOT NULL,
    max_price  DECIMAL(15,2) NOT NULL,
    is_active  BOOLEAN DEFAULT TRUE NOT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY unique_user_auction (user_id, auction_id),

    FOREIGN KEY (auction_id) REFERENCES Auctions(id) ON DELETE RESTRICT,
    FOREIGN KEY (user_id)    REFERENCES Users(id)    ON DELETE RESTRICT,

    INDEX idx_autobids_auction_active (auction_id, is_active),
    INDEX idx_autobids_user_active (user_id, is_active)
);

CREATE TABLE auction_deposits (
    id                     INT AUTO_INCREMENT PRIMARY KEY,

    auction_id             INT NOT NULL,
    user_id                INT NOT NULL,

    amount                 DECIMAL(15,2) NOT NULL,

    status                 ENUM(
        'PENDING',
        'SUCCEEDED',
        'FAILED',
        'REFUNDED',
        'APPLIED_TO_WIN_PAYMENT'
    ) DEFAULT 'PENDING' NOT NULL,

    payment_provider       VARCHAR(50) DEFAULT 'STRIPE',
    stripe_session_id      VARCHAR(255) UNIQUE,
    provider_payment_id    VARCHAR(255) UNIQUE,

    paid_at                DATETIME NULL,
    failed_at              DATETIME NULL,
    refunded_at            DATETIME NULL,
    applied_at             DATETIME NULL,

    refund_transaction_id  INT NULL,
    applied_transaction_id INT NULL,

    created_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (auction_id) REFERENCES Auctions(id) ON DELETE RESTRICT,
    FOREIGN KEY (user_id)    REFERENCES Users(id)    ON DELETE RESTRICT,

    UNIQUE KEY unique_user_auction_deposit (user_id, auction_id),

    INDEX idx_deposits_auction_status (auction_id, status),
    INDEX idx_deposits_user_status (user_id, status),
    INDEX idx_deposits_stripe_session (stripe_session_id),
    INDEX idx_deposits_created_at (created_at DESC)
);

CREATE TABLE auction_settlements (
    id                     INT AUTO_INCREMENT PRIMARY KEY,

    auction_id             INT NOT NULL UNIQUE,
    winner_id              INT NOT NULL,
    winning_bid_id         INT NULL,
    deposit_id             INT NULL,

    final_price            DECIMAL(15,2) NOT NULL,
    deposit_applied_amount DECIMAL(15,2) DEFAULT 0.00 NOT NULL,
    remaining_amount       DECIMAL(15,2) NOT NULL,

    status                 ENUM(
        'PENDING',
        'PAID',
        'FAILED',
        'EXPIRED',
        'CANCELLED'
    ) DEFAULT 'PENDING' NOT NULL,

    payment_provider       VARCHAR(50) DEFAULT 'STRIPE',
    stripe_session_id      VARCHAR(255) UNIQUE,
    provider_payment_id    VARCHAR(255) UNIQUE,

    due_at                 DATETIME NULL,
    paid_at                DATETIME NULL,
    failed_at              DATETIME NULL,
    expired_at             DATETIME NULL,
    cancelled_at           DATETIME NULL,

    created_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (auction_id)     REFERENCES Auctions(id)          ON DELETE RESTRICT,
    FOREIGN KEY (winner_id)      REFERENCES Users(id)             ON DELETE RESTRICT,
    FOREIGN KEY (winning_bid_id) REFERENCES Bids(id)              ON DELETE SET NULL,
    FOREIGN KEY (deposit_id)     REFERENCES auction_deposits(id)  ON DELETE SET NULL,

    INDEX idx_settlements_winner_status (winner_id, status),
    INDEX idx_settlements_status_due_at (status, due_at),
    INDEX idx_settlements_stripe_session (stripe_session_id)
);

CREATE TABLE Transactions (
    id                      INT AUTO_INCREMENT PRIMARY KEY,

    user_id                 INT NOT NULL,
    auction_id              INT NULL,
    deposit_id              INT NULL,
    settlement_id           INT NULL,

    amount                  DECIMAL(15,2) NOT NULL,

    type                    ENUM(
        'AUCTION_DEPOSIT',
        'DEPOSIT_REFUND',
        'DEPOSIT_APPLIED',
        'WIN_REMAINING_PAYMENT',
        'WIN_FULL_PAYMENT',
        'WALLET_TOPUP',
        'WALLET_WITHDRAW',
        'ADMIN_ADJUSTMENT'
    ) NOT NULL,

    status                  ENUM(
        'PENDING',
        'SUCCESS',
        'FAILED',
        'CANCELLED'
    ) DEFAULT 'PENDING' NOT NULL,

    payment_provider        VARCHAR(50) DEFAULT NULL,
    provider_transaction_id VARCHAR(255) UNIQUE,
    provider_session_id     VARCHAR(255) UNIQUE,

    wallet_delta            DECIMAL(15,2) DEFAULT 0.00 NOT NULL,
    balance_after           DECIMAL(15,2) NULL,

    metadata                JSON NULL,

    created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id)       REFERENCES Users(id)               ON DELETE RESTRICT,
    FOREIGN KEY (auction_id)    REFERENCES Auctions(id)            ON DELETE RESTRICT,
    FOREIGN KEY (deposit_id)    REFERENCES auction_deposits(id)    ON DELETE SET NULL,
    FOREIGN KEY (settlement_id) REFERENCES auction_settlements(id) ON DELETE SET NULL,

    INDEX idx_transactions_user (user_id),
    INDEX idx_transactions_auction (auction_id),
    INDEX idx_transactions_deposit (deposit_id),
    INDEX idx_transactions_settlement (settlement_id),
    INDEX idx_transactions_type_status (type, status),
    INDEX idx_transactions_created_at (created_at DESC)
);

ALTER TABLE auction_deposits
    ADD CONSTRAINT fk_deposit_refund_transaction
    FOREIGN KEY (refund_transaction_id) REFERENCES Transactions(id) ON DELETE SET NULL;

ALTER TABLE auction_deposits
    ADD CONSTRAINT fk_deposit_applied_transaction
    FOREIGN KEY (applied_transaction_id) REFERENCES Transactions(id) ON DELETE SET NULL;

CREATE TABLE Fraud_Alerts (
    id         INT AUTO_INCREMENT PRIMARY KEY,

    auction_id INT NOT NULL,
    user_id    INT NOT NULL,

    risk_score DECIMAL(3,2) NOT NULL,
    reasons    JSON NOT NULL,

    status     ENUM(
        'OPEN',
        'REVIEWING',
        'RESOLVED',
        'DISMISSED'
    ) DEFAULT 'OPEN' NOT NULL,

    reviewed_by INT NULL,
    reviewed_at DATETIME NULL,
    admin_note  TEXT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (auction_id)  REFERENCES Auctions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)     REFERENCES Users(id)    ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES Users(id)    ON DELETE SET NULL,

    INDEX idx_fraud_risk (risk_score DESC),
    INDEX idx_fraud_auction (auction_id),
    INDEX idx_fraud_user (user_id),
    INDEX idx_fraud_status (status),
    INDEX idx_fraud_created_at (created_at DESC)
);

CREATE TABLE Watchlists (
    id         INT AUTO_INCREMENT PRIMARY KEY,

    user_id    INT NOT NULL,
    auction_id INT NOT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY unique_user_watch_auction (user_id, auction_id),

    FOREIGN KEY (user_id)    REFERENCES Users(id)    ON DELETE CASCADE,
    FOREIGN KEY (auction_id) REFERENCES Auctions(id) ON DELETE CASCADE,

    INDEX idx_watchlists_user (user_id),
    INDEX idx_watchlists_auction (auction_id)
);

CREATE TABLE Notifications (
    id         INT AUTO_INCREMENT PRIMARY KEY,

    user_id    INT NOT NULL,
    auction_id INT NULL,

    type       ENUM(
        'BID_OUTBID',
        'BID_LEADING',
        'AUCTION_APPROVED',
        'AUCTION_REJECTED',
        'AUCTION_ENDED',
        'AUCTION_WON',
        'DEPOSIT_SUCCEEDED',
        'DEPOSIT_REFUNDED',
        'PAYMENT_REQUIRED',
        'PAYMENT_SUCCESS',
        'FRAUD_ALERT',
        'SYSTEM'
    ) DEFAULT 'SYSTEM' NOT NULL,

    title      VARCHAR(255) NOT NULL,
    message    TEXT NOT NULL,
    is_read    BOOLEAN DEFAULT FALSE NOT NULL,

    action_url VARCHAR(500) NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at    DATETIME NULL,

    FOREIGN KEY (user_id)    REFERENCES Users(id)    ON DELETE CASCADE,
    FOREIGN KEY (auction_id) REFERENCES Auctions(id) ON DELETE SET NULL,

    INDEX idx_notifications_user_read (user_id, is_read, created_at DESC),
    INDEX idx_notifications_auction (auction_id),
    INDEX idx_notifications_type (type)
);

CREATE TABLE Admin_Action_Logs (
    id          INT AUTO_INCREMENT PRIMARY KEY,

    admin_id    INT NULL,
    target_type VARCHAR(50) NOT NULL,
    target_id   INT NULL,

    action      VARCHAR(100) NOT NULL,
    old_value   JSON NULL,
    new_value   JSON NULL,
    note        TEXT NULL,

    ip_address  VARCHAR(45) NULL,
    user_agent  VARCHAR(500) NULL,

    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (admin_id) REFERENCES Users(id) ON DELETE SET NULL,

    INDEX idx_admin_logs_admin (admin_id),
    INDEX idx_admin_logs_target (target_type, target_id),
    INDEX idx_admin_logs_action (action),
    INDEX idx_admin_logs_created_at (created_at DESC)
);

-- INSERT INTO Users (username, email, password, role, account_status, balance)
-- VALUES (
--     'admin2',                              
--     'admin2@brosgem.com',                  
--     '$2b$10$hyRVdnViH4LsooWKZV4tceus9xw.fk5SjN7nhxZdChtBM/366xKtW',
--     'admin',
--     'active',
--     0.00
-- );

-- SELECT id, username, email, role FROM Users WHERE role = 'admin';