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
