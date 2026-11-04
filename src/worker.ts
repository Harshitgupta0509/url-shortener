import { analyticsPool } from "./db";
import type { ClickEvent } from "./events";
import { CLICKS_TOPIC, ensureTopics, kafka } from "./kafka";

async function saveClicks(events: ClickEvent[]): Promise<void> {
  if (events.length === 0) return;

  await analyticsPool.query(
    `INSERT INTO clicks (event_id, code, region, country, device, clicked_at)
     SELECT * FROM UNNEST(
       $1::uuid[], $2::text[], $3::text[], $4::text[], $5::text[], $6::timestamptz[]
     )
     ON CONFLICT (event_id) DO NOTHING`,
    [
      events.map((event) => event.eventId),
      events.map((event) => event.code),
      events.map((event) => event.region),
      events.map((event) => event.country),
      events.map((event) => event.device),
      events.map((event) => event.clickedAt),
    ],
  );
}

async function start(): Promise<void> {
  await ensureTopics();

  const consumer = kafka.consumer({ groupId: "analytics-worker" });
  await consumer.connect();
  await consumer.subscribe({ topic: CLICKS_TOPIC, fromBeginning: true });

  await consumer.run({
    eachBatchAutoResolve: false,
    eachBatch: async ({ batch, resolveOffset, heartbeat }) => {
      const events: ClickEvent[] = [];

      for (const message of batch.messages) {
        try {
          events.push(JSON.parse(message.value?.toString() ?? ""));
        } catch {
          console.error(`Skipped invalid message at offset ${message.offset}`);
        }
      }

      await saveClicks(events);
      resolveOffset(batch.lastOffset());
      await heartbeat();

      console.log(`Saved ${events.length} clicks`);
    },
  });

  console.log("Analytics worker is running");
}

start().catch((error) => {
  console.error("Worker failed:", error);
  process.exit(1);
});
