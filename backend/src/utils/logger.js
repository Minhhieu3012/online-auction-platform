// Mã màu cho Terminal
const colors = {
  reset: "\x1b[0m",
  info: "\x1b[36m", // Cyan
  success: "\x1b[32m", // Green
  warn: "\x1b[33m", // Yellow
  error: "\x1b[31m", // Red
};

const getTimestamp = () => new Date().toISOString();

const logger = {
  info: (message, ...args) => {
    console.log(`${colors.info}[INFO] [${getTimestamp()}]${colors.reset} ${message}`, ...args);
  },
  success: (message, ...args) => {
    console.log(`${colors.success}[SUCCESS] [${getTimestamp()}]${colors.reset} ${message}`, ...args);
  },
  warn: (message, ...args) => {
    console.warn(`${colors.warn}[WARN] [${getTimestamp()}]${colors.reset} ${message}`, ...args);
  },
  error: (message, ...args) => {
    console.error(`${colors.error}[ERROR] [${getTimestamp()}]${colors.reset} ${message}`, ...args);
  },
};

module.exports = logger;
