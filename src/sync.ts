import { addToBloom } from "./bloom";
import { pool } from "./db";
import type { LinkCreatedEvent } from "./events";
import { ensureTopics, kafka, LINKS_TOPIC } from "./kafka";

const REGION = process.env.REGION ?? "unknown";

async function runLinkSync(): Promise<void> {
  await ensureTopics();

  const consumer = kafka.consumer({ groupId: `link-sync-${REGION}` });
  await consumer.connect();
  await consumer.subscribe({ topic: LINKS_TOPIC, fromBeginning: true });

  await consumer.run({
    eachMessage: async ({ message }) => {
      let event: LinkCreatedEvent;

      try {
        event = JSON.parse(message.value?.toString() ?? "");
      } catch {
        console.error(`Skipped invalid link event at ${message.offset}`);
        return;
      }

      if (event.createdRegion === REGION) return;

      await pool.query(
        `INSERT INTO links (id, code, long_url, created_region, created_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO NOTHING`,
        [
          event.id,
          event.code,
          event.longUrl,
          event.createdRegion,
          event.createdAt,
        ],
      );

      await addToBloom(event.code);

      const delay = Date.now() - Date.parse(event.createdAt);
      console.log(`Synced ${event.code} after ${delay} ms`);
    },
  });

  console.log("Link sync is running");
}

export function startLinkSync(): void {
  runLinkSync().catch((error) => {
    console.error("Link sync failed:", error.message);
    setTimeout(startLinkSync, 5000);
  });
}
