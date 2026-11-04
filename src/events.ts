import { randomUUID } from "crypto";
import { Partitioners } from "kafkajs";
import { CLICKS_TOPIC, kafka, LINKS_TOPIC } from "./kafka";

export type ClickEvent = {
  eventId: string;
  code: string;
  region: string;
  country: string;
  device: string;
  clickedAt: string;
};

export type LinkCreatedEvent = {
  id: string;
  code: string;
  longUrl: string;
  createdRegion: string;
  createdAt: string;
};

type QueuedMessage = {
  topic: string;
  key: string;
  value: string;
};

const FLUSH_INTERVAL_MS = 100;
const BATCH_SIZE = 1000;
const MAX_BUFFER_SIZE = 50000;
const analyticsEnabled = process.env.ANALYTICS_ENABLED !== "false";

const producer = kafka.producer({
  createPartitioner: Partitioners.DefaultPartitioner,
  retry: { retries: 1 },
});

const buffer: QueuedMessage[] = [];
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

  const event: ClickEvent = {
    eventId: randomUUID(),
    code,
    region: process.env.REGION ?? "unknown",
    country: country ?? "unknown",
    device: getDevice(userAgent),
    clickedAt: new Date().toISOString(),
  };

  buffer.push({
    topic: CLICKS_TOPIC,
    key: code,
    value: JSON.stringify(event),
  });
}

export function publishLinkCreated(event: LinkCreatedEvent): void {
  buffer.push({
    topic: LINKS_TOPIC,
    key: event.code,
    value: JSON.stringify(event),
  });
}

async function flushMessages(): Promise<void> {
  if (flushing || buffer.length === 0) return;

  flushing = true;
  const batch = buffer.splice(0, BATCH_SIZE);

  try {
    if (!connected) await producer.connect();

    const byTopic = new Map<string, { key: string; value: string }[]>();

    for (const { topic, key, value } of batch) {
      const messages = byTopic.get(topic) ?? [];
      messages.push({ key, value });
      byTopic.set(topic, messages);
    }

    await producer.sendBatch({
      topicMessages: [...byTopic].map(([topic, messages]) => ({
        topic,
        messages,
      })),
    });
  } catch (error) {
    buffer.unshift(...batch);
    console.error("Could not publish events:", (error as Error).message);
  } finally {
    flushing = false;
  }
}

setInterval(flushMessages, FLUSH_INTERVAL_MS);

setInterval(() => {
  if (droppedEvents > 0) {
    console.error(`Dropped ${droppedEvents} click events`);
    droppedEvents = 0;
  }
}, 10000);
