const express = require("express");
const cors = require("cors");
const path = require("path");

const PaymentController = require("./controllers/payment");

const app = express();

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);

/**
 * Stripe webhook phải đứng trước express.json().
 * Giữ cả 2 endpoint để không phá lệnh stripe listen cũ của team:
 * - /api/payments/webhook: hướng chuẩn mới
 * - /api/webhook: alias cũ nếu team đang dùng
 */
app.post(
  "/api/payments/webhook",
  express.raw({ type: "application/json" }),
  PaymentController.handleStripeWebhook,
);

app.post(
  "/api/webhook",
  express.raw({ type: "application/json" }),
  PaymentController.handleStripeWebhook,
);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.use("/uploads", express.static(path.join(__dirname, "../public/uploads")));

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Online Auction API Gateway is running smoothly!",
    timestamp: new Date().toISOString(),
  });
});

const routes = require("./routes/index");
app.use("/api", routes);

module.exports = app;