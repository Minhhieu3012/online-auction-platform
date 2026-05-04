const express = require("express");
const cors = require("cors");
const PaymentController = require("./controllers/payment");

const app = express();

// 1. Cấu hình CORS
app.use(cors());

/**
 * 2. ROUTE WEBHOOK (PHẢI ĐẶT TRƯỚC express.json)
 * Đường dẫn này phải khớp chính xác với lệnh 'stripe listen' của bạn.
 * Chúng ta dùng express.raw để giữ nguyên gói tin gốc từ Stripe phục vụ việc xác thực chữ ký.
 */
app.post(
  "/api/payments/webhook", 
  express.raw({ type: "application/json" }), 
  PaymentController.handleStripeWebhook
);

// 3. Parse body dạng JSON cho TẤT CẢ các API còn lại (bidding, auth, auctions...)
app.use(express.json());

// 4. API Health-check
app.use("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Online Auction API Gateway is running smoothly!",
    timestamp: new Date(),
  });
});

// 5. Kết nối các Routes chính
const routes = require("./routes/index");
app.use("/api", routes);

module.exports = app;