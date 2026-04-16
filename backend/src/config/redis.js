const logger = require("../utils/logger");
const { createClient } = require("redis");
require("dotenv").config();

const redisClient = createClient({
  url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
});

redisClient.on("error", (err) => console.log("[Redis] Redis Client Error", err));
redisClient.on("connect", () => console.log("[Redis] Connected to Redis server"));

// Connect to Redis server
redisClient.connect().catch(console.error);

module.exports = redisClient;
