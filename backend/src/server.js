require("dotenv").config();
const app = require("./app");

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`[Core Engine] Server is running on http://localhost:${PORT}`);
  console.log(`[Health Check] http://localhost:${PORT}/api/health`);
});
