USE auction_db;

-- Xóa hết dữ liệu cũ để làm lại cho sạch
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE Bids;
TRUNCATE TABLE Transactions;
TRUNCATE TABLE Auctions;
TRUNCATE TABLE Products;
TRUNCATE TABLE Users;
SET FOREIGN_KEY_CHECKS = 1;

-- Chèn lại chính xác ID = 1
INSERT INTO Users (id, username, email, password, balance) 
VALUES (1, 'minhhieu', 'hieu@example.com', 'hashed_pwd', 10000.00);

INSERT INTO Products (id, name, description) 
VALUES (1, 'MacBook Pro M3', 'Hàng test hệ thống');

INSERT INTO Auctions (id, product_id, status, current_price, step_price, end_time) 
VALUES (1, 1, 'Active', 1000.00, 100.00, '2027-12-31 23:59:59');

SELECT * FROM Users;
SELECT * FROM auction_db.Auctions WHERE id = 1;