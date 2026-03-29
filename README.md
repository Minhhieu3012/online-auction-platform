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
- **Ultra-low Latency:** < 50ms bid propagation via WebSockets.
- **High Concurrency:** Engineered to handle thousands of concurrent bids without race conditions.
- **AI Integration:** Real-time fraud scoring (Shill Bidding) using FastAPI & Python.

---

## ✨ Key Features

### ⚡ The Bidding Experience
- **Real-time Engine:** Instant price updates via Socket.io (no refreshes).
- **Smart Proxy Bidding:** Automated bidding up to a user-defined limit.
- **Soft-Close (Anti-sniping):** Extends auction time by 60s if a bid occurs in the final seconds to prevent last-second "sniping".

### 🛡️ Trust & Safety
- **AI Shill Score:** Analyzes bid frequency, patterns, and win/loss ratios to flag suspicious price manipulation in real-time.
- **Admin Dashboard:** Comprehensive monitoring for auction health and fraud alerts.

---

## 🏗 Architecture

- **Frontend:** Vanilla JS (Lightweight, high performance).
- **Backend:** Node.js/Express (Event-driven API Gateway).
- **Real-time:** Socket.io (Isolated by `AuctionID` for scalability).
- **Stream Processing:** Kafka (Ensures zero bid loss during traffic spikes).
- **Cache & Locks:** Redis (Lua Scripts for atomic updates & Optimistic Locking).
- **Database:** MySQL (ACID compliant for financial/transactional integrity).
- **AI Service:** Python/FastAPI (Async data processing for fraud detection).

---

## ⚡ Handling Concurrency & Data Integrity

To maintain a "Single Source of Truth" during peak loads, we implemented:
1. **Redis Atomic Operations:** Using Lua scripts to validate and update bids in a single non-blocking step.
2. **Optimistic Locking:** Version-based consistency at the database level.
3. **Idempotency:** Unique keys to prevent duplicate bids from network retries.
4. **State Machine:** Strictly manages the auction lifecycle: `Draft` -> `Scheduled` -> `Active` -> `Closing` -> `Ended` -> `Payment Pending`.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+), Python (3.9+), MySQL, Redis, Kafka.

### Installation
1. Clone repository:

   ```bash
   git clone https://github.com/Minhhieu3012/online-auction-platform.git
   ```

2. Set up AI service:
   ```bash
   cd ai-service    
   pip install -r requirements.txt
   uvicorn main:app --port 8000
   ```

3. Environment:

- Rename ```.env.example``` to ```.env``` and and configure your credentials.

4. Launch:

    ```bash
    npm run db:migrate
    npm run dev
    ```

---

## 🧪 Testing

- Stress Test: Handled 100+ concurrent requests/sec via JMeter with 0% failure rate.
- Data Integrity: Verified highest bid consistency across 100+ simulated parallel users.
