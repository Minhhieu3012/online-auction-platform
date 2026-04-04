const { Connection } = require("mysql2");
const mysql = require("mysql2/promise");
require("dotenv").config();

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  port: process.env.MYSQL_PORT,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DB,
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 0,
});

//  Test the connection
pool
  .getConnection()
  .then((Connection) => {
    console.log("[DB] Connected to MySQL database");
    Connection.release();
  })
  .catch((err) => {
    console.error("[DB] Error connecting to MySQL database:", err.message);
  });

module.exports = pool;
