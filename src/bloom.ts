import { pool } from "./db";
import { redis } from "./redis";

const BLOOM_KEY = "links:bloom";
const ERROR_RATE = "0.01";
const CAPACITY = "1000000";
const BATCH_SIZE = 1000;
const bloomEnabled = process.env.BLOOM_ENABLED !== "false";

let bloomReady = false;

async function rebuildBloomFilter(): Promise<void> {
  bloomReady = false;

  await redis.del(BLOOM_KEY);
  await redis.sendCommand(["BF.RESERVE", BLOOM_KEY, ERROR_RATE, CAPACITY]);

  let lastId = "0";
  let total = 0;

  while (true) {
    const result = await pool.query(
      "SELECT id, code FROM links WHERE id > $1 ORDER BY id LIMIT $2",
      [lastId, BATCH_SIZE],
    );

    if (result.rows.length === 0) break;

    const codes: string[] = result.rows.map((row) => row.code);
    await redis.sendCommand(["BF.MADD", BLOOM_KEY, ...codes]);

    total += codes.length;
    lastId = result.rows[result.rows.length - 1].id;
  }

  bloomReady = true;
  console.log(`Bloom filter ready with ${total} links`);
}

if (bloomEnabled) {
  redis.on("ready", () => {
    rebuildBloomFilter().catch((error) => {
      console.error("Bloom filter rebuild failed:", error.message);
    });
  });

  redis.on("reconnecting", () => {
    bloomReady = false;
  });
}

export async function mightExist(code: string): Promise<boolean> {
  if (!bloomEnabled || !bloomReady) return true;

  try {
    const reply = await redis.sendCommand(["BF.EXISTS", BLOOM_KEY, code]);
    return Number(reply) === 1;
  } catch {
    return true;
  }
}

export async function addToBloom(code: string): Promise<void> {
  if (!bloomEnabled) return;

  try {
    await redis.sendCommand([
      "BF.INSERT",
      BLOOM_KEY,
      "NOCREATE",
      "ITEMS",
      code,
    ]);
  } catch (error) {
    console.error("Could not add link to Bloom filter:", error);
  }
}
