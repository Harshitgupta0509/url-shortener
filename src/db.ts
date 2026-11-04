import { Pool } from "pg";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const analyticsPool = new Pool({
  connectionString: process.env.ANALYTICS_DATABASE_URL,
});
