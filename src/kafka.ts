import { Kafka, logLevel } from "kafkajs";

export const CLICKS_TOPIC = "link.clicked";

export const kafka = new Kafka({
  clientId: "url-shortener",
  brokers: ["localhost:19092"],
  logLevel: logLevel.ERROR,
});
