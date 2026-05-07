const logger = require("../utils/logger");
const mysql = require("mysql2/promise");
require("dotenv").config();

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || "127.0.0.1",
  port: Number(process.env.MYSQL_PORT || 3307),
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "",
  database: process.env.MYSQL_DB || "auction_db",

  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 0,

  charset: "utf8mb4",
  timezone: "Z",
  dateStrings: true,

  namedPlaceholders: false,
  multipleStatements: false,
});

async function configureConnectionCharset(connection) {
  await connection.query("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
  await connection.query("SET character_set_client = utf8mb4");
  await connection.query("SET character_set_connection = utf8mb4");
  await connection.query("SET character_set_results = utf8mb4");
}

pool
  .getConnection()
  .then(async (connection) => {
    try {
      await configureConnectionCharset(connection);
      logger.success("[DB] Connected to MySQL database");
    } finally {
      connection.release();
    }
  })
  .catch((err) => {
    logger.error("[DB] Error connecting to MySQL database:", err.message);
  });

module.exports = pool;