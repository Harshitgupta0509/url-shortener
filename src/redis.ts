import { createClient } from "redis";

export const redis = createClient({
  url: "redis://localhost:6380",
  disableOfflineQueue: true,
});

redis.on("error", (error) => {
  console.error("Redis error:", error.message);
});

redis.connect().catch((error) => {
  console.error("Redis connection failed:", error.message);
});
