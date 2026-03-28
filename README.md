# 🔨 Online Auction Platform

> Real-time English Auction system with high concurrency processing capability and integrated AI fraud detection.

![HTML5](https://img.shields.io/badge/html5-%23E34F26.svg?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/css3-%231572B6.svg?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/javascript-%23323330.svg?style=for-the-badge&logo=javascript&logoColor=%23F7DF1E)
![NodeJS](https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white)
![Express.js](https://img.shields.io/badge/express.js-%23404d59.svg?style=for-the-badge&logo=express&logoColor=%2361DAFB)
![Socket.io](https://img.shields.io/badge/Socket.io-black?style=for-the-badge&logo=socket.io&badgeColor=010101)
![MySQL](https://img.shields.io/badge/mysql-4479A1.svg?style=for-the-badge&logo=mysql&logoColor=white)
![Redis](https://img.shields.io/badge/redis-%23DD0031.svg?style=for-the-badge&logo=redis&logoColor=white)
![Python](https://img.shields.io/badge/python-3670A0?style=for-the-badge&logo=python&logoColor=ffdd54)
![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)

## 📖 Overview
Unlike traditional e-commerce with fixed prices, this system implements an **English Auction** model (increasing prices). Users compete by bidding in real time, the system continuously updates prices, and determines the winner when the countdown ends.

**Core Technical Objectives:**
- **Realtime (Latency < 50ms):** Instantly update bids for all clients.
- **High Concurrency:** Ensure data integrity when thousands of users bid simultaneously, avoiding race conditions.

---

## ✨ Key Features

### 👤 User Interface (Bidder & Seller)
- Post products and create auctions (Draft -> Scheduled -> Active).
- **Real-time Bidding:** Prices and bid history are continuously updated via WebSocket, no page reload required.
- **Auto-bid (Proxy Bidding):** Users set a maximum price, and the system automatically increases the bid for them if it is overtaken.
- **Anti-sniping (Soft Close):** If someone places a bid in the last 10 seconds, the system automatically extends the deadline by 30-60 seconds to ensure fairness.

### 🛡 Administration & Advanced Features
- **Live Shill Score (AI Detection):** A system for scoring suspected fraud (price manipulation) based on bid frequency, outbid duration, price increase rate, and Win/Lose ratio.
- Monitoring dashboard for Sellers and Admins.

---
