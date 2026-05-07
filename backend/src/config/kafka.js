const logger = require("../utils/logger");
const { Kafka } = require("kafkajs");
require("dotenv").config();

const kafkaConfig = {
  clientId: "online-auction-platform",
  brokers: [process.env.KAFKA_BROKER],
};

// Bật bảo mật SSL và SASL cho Render
if (process.env.NODE_ENV === "production") {
  kafkaConfig.ssl = true;
  kafkaConfig.sasl = {
    mechanism: "scram-sha-256", // Aiven mặc định dùng chuẩn này
    username: process.env.KAFKA_USERNAME,
    password: process.env.KAFKA_PASSWORD,
  };
}

const kafka = new Kafka(kafkaConfig);

const producer = kafka.producer();

const connectProducer = async () => {
  try {
    await producer.connect();
    logger.success("[Kafka] Producer đã kết nối thành công!");
  } catch (error) {
    logger.error("[Kafka Error] Không thể kết nối Producer:", error.message);
  }
};

const disconnectProducer = async () => {
  try {
    await producer.disconnect();
    logger.info("[Kafka] Producer đã ngắt kết nối an toàn.");
  } catch (error) {
    logger.error("[Kafka Error] Lỗi khi ngắt kết nối:", error.message);
  }
};

module.exports = {
  kafka,
  producer,
  connectProducer,
  disconnectProducer,
};
