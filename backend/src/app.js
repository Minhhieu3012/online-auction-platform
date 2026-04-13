const express = require("express");
const cors = require("cors");
const PaymentController = require("./controllers/payment");

const app = express();

// Middlewares
app.use(cors());

app.post("/api/webhook", express.raw({ type: "application/json" }), PaymentController.handleStripeWebhook);

// Parse body dạng JSON cho TẤT CẢ các API còn lại (bidding, auth...)
app.use(express.json());

// API Health-check
app.use("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Online Auction API Gateway is running smoothly!",
    timestamp: new Date(),
  });
});

// Routes
const routes = require("./routes/index");
app.use("/api", routes);

module.exports = app;
