import { randomUUID } from "crypto";
import { Partitioners } from "kafkajs";
import { CLICKS_TOPIC, kafka } from "./kafka";

export type ClickEvent = {
  eventId: string;
  code: string;
  region: string;
  country: string;
  device: string;
  clickedAt: string;
};

const FLUSH_INTERVAL_MS = 100;
const BATCH_SIZE = 1000;
const MAX_BUFFER_SIZE = 50000;
const analyticsEnabled = process.env.ANALYTICS_ENABLED !== "false";

const producer = kafka.producer({
  createPartitioner: Partitioners.DefaultPartitioner,
  retry: { retries: 1 },
});

const buffer: ClickEvent[] = [];
let connected = false;
let flushing = false;
let droppedEvents = 0;

producer.on(producer.events.CONNECT, () => {
  connected = true;
});

producer.on(producer.events.DISCONNECT, () => {
  connected = false;
});

function getDevice(userAgent = ""): string {
  if (/bot|crawl|spider/i.test(userAgent)) return "bot";
  if (/ipad|tablet/i.test(userAgent)) return "tablet";
  if (/mobile|android|iphone/i.test(userAgent)) return "mobile";
  return "desktop";
}

export function trackClick(
  code: string,
  userAgent?: string,
  country?: string,
): void {
  if (!analyticsEnabled) return;

  if (buffer.length >= MAX_BUFFER_SIZE) {
    droppedEvents++;
    return;
  }

  buffer.push({
    eventId: randomUUID(),
    code,
    region: process.env.REGION ?? "india",
    country: country ?? "unknown",
    device: getDevice(userAgent),
    clickedAt: new Date().toISOString(),
  });
}

async function flushClicks(): Promise<void> {
  if (flushing || buffer.length === 0) return;

  flushing = true;
  const batch = buffer.splice(0, BATCH_SIZE);

  try {
    if (!connected) await producer.connect();

    await producer.send({
      topic: CLICKS_TOPIC,
      messages: batch.map((event) => ({
        key: event.code,
        value: JSON.stringify(event),
      })),
    });
  } catch (error) {
    buffer.unshift(...batch);
    console.error("Could not publish clicks:", (error as Error).message);
  } finally {
    flushing = false;
  }
}

if (analyticsEnabled) {
  setInterval(flushClicks, FLUSH_INTERVAL_MS);

  setInterval(() => {
    if (droppedEvents > 0) {
      console.error(`Dropped ${droppedEvents} click events`);
      droppedEvents = 0;
    }
  }, 10000);
}
