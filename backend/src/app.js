const express = require("express");
const cors = require("cors");

const app = express();

// Middlewares
app.use(cors());
app.use(express.json()); // Parse body dạng JSON

// API Health-check
app.use("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Online Auction API Gateway is running smoothly!",
    timestamp: new Date(),
  });
});

// Routes

module.exports = app;
