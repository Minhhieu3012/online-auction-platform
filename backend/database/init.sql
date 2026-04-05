CREATE DATABASE IF NOT EXISTS auction_db;
USE auction_db;

-- 1. DỌN DẸP BẢNG CŨ (Xóa từ Con -> Cha để không vướng Khóa ngoại)
DROP TABLE IF EXISTS Bids;
DROP TABLE IF EXISTS Auctions;
DROP TABLE IF EXISTS Users;

-- 2. TẠO LẠI CÁC BẢNG CHUẨN PRODUCTION

CREATE TABLE Users (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    username   VARCHAR(50)  NOT NULL UNIQUE,
    email      VARCHAR(100) NOT NULL UNIQUE,
    password   VARCHAR(255) NOT NULL,
    balance    DECIMAL(15,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Auctions (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    status        ENUM('Scheduled','Active','Closing','Ended','Payment Pending') DEFAULT 'Scheduled',
    current_price DECIMAL(15,2) NOT NULL,
    step_price    DECIMAL(15,2) NOT NULL,
    end_time      DATETIME NOT NULL,
    version       INT DEFAULT 0,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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