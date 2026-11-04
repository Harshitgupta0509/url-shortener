import { createClient } from "redis";

export const redis = createClient({
  url: process.env.REDIS_URL,
  disableOfflineQueue: true,
});

redis.on("error", (error) => {
  console.error("Redis error:", error.message);
});

redis.connect().catch((error) => {
  console.error("Redis connection failed:", error.message);
});
