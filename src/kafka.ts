import { Kafka, logLevel } from "kafkajs";

export const CLICKS_TOPIC = "link.clicked";
export const LINKS_TOPIC = "link.created";

export const kafka = new Kafka({
  clientId: "url-shortener",
  brokers: (process.env.KAFKA_BROKERS ?? "redpanda:9092").split(","),
  logLevel: logLevel.NOTHING,
});

export async function ensureTopics(): Promise<void> {
  const admin = kafka.admin();
  await admin.connect();

  try {
    const existing = await admin.listTopics();
    const missing = [CLICKS_TOPIC, LINKS_TOPIC].filter(
      (topic) => !existing.includes(topic),
    );

    if (missing.length > 0) {
      await admin.createTopics({
        topics: missing.map((topic) => ({ topic, numPartitions: 3 })),
      });
    }
  } finally {
    await admin.disconnect();
  }
}
