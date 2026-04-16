const logger = require("../utils/logger");
const { Kafka } = require("kafkajs");
require("dotenv").config();

const kafka = new Kafka({
  clientId: "online-auction-platform",
  brokers: [process.env.KAFKA_BROKER || "localhost:9092"],
  connectionTimeout: 3000,
});

const producer = kafka.producer();

const connectProducer = async () => {
  try {
    await producer.connect();
    console.log("[Kafka] Producer đã kết nối thành công!");
  } catch (error) {
    console.error("[Kafka Error] Không thể kết nối Producer:", error.message);
  }
};

const disconnectProducer = async () => {
  try {
    await producer.disconnect();
    console.log("[Kafka] Producer đã ngắt kết nối an toàn.");
  } catch (error) {
    console.error("[Kafka Error] Lỗi khi ngắt kết nối:", error.message);
  }
};

module.exports = {
  kafka,
  producer,
  connectProducer,
  disconnectProducer,
};
