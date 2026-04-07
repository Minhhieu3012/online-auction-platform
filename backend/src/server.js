require("dotenv").config();
require("./config/db");
require("./config/redis");
require("./config/queue");
require("./services/auction-worker");

const app = require("./app");

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`[Core Engine] Server is running on http://localhost:${PORT}`);
  console.log(`[Health Check] http://localhost:${PORT}/api/health`);
});

process.on("uncaughtException", (err) => {
  console.error("[FATAL] Uncaught Exception:", err.message);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("[FATAL] Unhandled Rejection:", reason);
  process.exit(1);
});
