USE auction_db;

-- Xóa theo thứ tự để tránh vướng Foreign Key
DROP TABLE IF EXISTS Transactions;
DROP TABLE IF EXISTS Bids;
DROP TABLE IF EXISTS Auctions;
DROP TABLE IF EXISTS Products;
DROP TABLE IF EXISTS Users;

-- 1. Bảng Users
CREATE TABLE Users (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    username     VARCHAR(50) NOT NULL UNIQUE,
    email        VARCHAR(100) NOT NULL UNIQUE,
    password     VARCHAR(255) NOT NULL,
    balance      DECIMAL(15,2) DEFAULT 0.00,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Bảng Products (Thông tin sản phẩm đấu giá)
CREATE TABLE Products (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    category    VARCHAR(100),
    image_url   VARCHAR(500),
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Bảng Auctions (Gắn kết Product và Auction)
CREATE TABLE Auctions (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    product_id    INT NOT NULL,
    status        ENUM('Scheduled','Active','Closing','Ended','Payment Pending') DEFAULT 'Scheduled',
    current_price DECIMAL(15,2) NOT NULL,
    step_price    DECIMAL(15,2) NOT NULL,
    end_time      DATETIME NOT NULL,
    version       INT DEFAULT 0,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES Products(id) ON DELETE RESTRICT
);

-- 4. Bảng Bids (Bảng chịu tải cao nhất)
CREATE TABLE Bids (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    auction_id INT NOT NULL,
    user_id    INT NOT NULL,
    bid_amount DECIMAL(15,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (auction_id) REFERENCES Auctions(id) ON DELETE RESTRICT,
    FOREIGN KEY (user_id)    REFERENCES Users(id)    ON DELETE RESTRICT,
    INDEX idx_bids_auction_time (auction_id, created_at DESC)
);

-- 5. Bảng Transactions (Lịch sử dòng tiền)
CREATE TABLE Transactions (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT NOT NULL,
    auction_id  INT NOT NULL,
    amount      DECIMAL(15,2) NOT NULL,
    type        ENUM('HOLD', 'REFUND', 'WIN_PAYMENT') NOT NULL,
    status      ENUM('PENDING', 'SUCCESS', 'FAILED') DEFAULT 'SUCCESS',
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)    REFERENCES Users(id)    ON DELETE RESTRICT,
    FOREIGN KEY (auction_id) REFERENCES Auctions(id) ON DELETE RESTRICT
);