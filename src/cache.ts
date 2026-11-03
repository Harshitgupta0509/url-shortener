import { redis } from "./redis";

const CACHE_TTL_SECONDS = 3600;
const cacheEnabled = process.env.CACHE_ENABLED !== "false";

export async function getCachedUrl(code: string): Promise<string | null> {
  if (!cacheEnabled) return null;

  try {
    return await redis.get(`link:${code}`);
  } catch {
    return null;
  }
}

export async function cacheUrl(code: string, url: string): Promise<void> {
  if (!cacheEnabled) return;

  try {
    await redis.setEx(`link:${code}`, CACHE_TTL_SECONDS, url);
  } catch {
    // The redirect should still work if Redis is down.
  }
}
