CREATE DATABASE IF NOT EXISTS auction_db;
USE auction_db;

DROP TABLE IF EXISTS Fraud_Alerts;
DROP TABLE IF EXISTS AutoBids;
DROP TABLE IF EXISTS Transactions;
DROP TABLE IF EXISTS Bids;
DROP TABLE IF EXISTS Auctions;
DROP TABLE IF EXISTS Products;
DROP TABLE IF EXISTS Users;

CREATE TABLE Users (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    username   VARCHAR(50)  NOT NULL UNIQUE,
    email      VARCHAR(100) NOT NULL UNIQUE,
    password   VARCHAR(255) NOT NULL,
    balance    DECIMAL(15,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Products (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    category    VARCHAR(100),
    image_url   VARCHAR(500),
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Auctions (
    id                INT AUTO_INCREMENT PRIMARY KEY,
    product_id        INT NOT NULL,
    created_by        INT NOT NULL,
    status            ENUM('Scheduled','Active','Closing','Ended','Payment Pending', 'Completed') DEFAULT 'Scheduled',
    current_price     DECIMAL(15,2) NOT NULL,
    step_price        DECIMAL(15,2) NOT NULL,
    end_time          DATETIME NOT NULL,
    version           INT DEFAULT 0,
    
    stripe_session_id VARCHAR(255) UNIQUE,
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES Products(id) ON DELETE RESTRICT,
    FOREIGN KEY (created_by) REFERENCES Users(id)    ON DELETE RESTRICT  
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
    INDEX idx_bids_auction_user (auction_id, user_id) 
);

CREATE TABLE Transactions (
    id                      INT AUTO_INCREMENT PRIMARY KEY,
    user_id                 INT NOT NULL,
    auction_id              INT NOT NULL,
    amount                  DECIMAL(15,2) NOT NULL,
    type                    ENUM('HOLD', 'REFUND', 'WIN_PAYMENT') DEFAULT 'WIN_PAYMENT',
    status                  ENUM('PENDING', 'SUCCESS', 'FAILED') DEFAULT 'SUCCESS',
    provider_transaction_id VARCHAR(255) UNIQUE,
    created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)    REFERENCES Users(id)    ON DELETE RESTRICT,
    FOREIGN KEY (auction_id) REFERENCES Auctions(id) ON DELETE RESTRICT
);

CREATE TABLE AutoBids (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    auction_id INT NOT NULL,
    user_id    INT NOT NULL,
    max_price  DECIMAL(15,2) NOT NULL,
    is_active  BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_user_auction (user_id, auction_id),
    FOREIGN KEY (auction_id) REFERENCES Auctions(id) ON DELETE RESTRICT,  
    FOREIGN KEY (user_id)    REFERENCES Users(id)    ON DELETE RESTRICT    
);

CREATE TABLE Fraud_Alerts (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    auction_id INT NOT NULL,
    user_id    INT NOT NULL,
    risk_score DECIMAL(3,2) NOT NULL, 
    reasons    JSON NOT NULL, 
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (auction_id) REFERENCES Auctions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)    REFERENCES Users(id)    ON DELETE CASCADE,
    INDEX idx_fraud_risk (risk_score DESC)
);