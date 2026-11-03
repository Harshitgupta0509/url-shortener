import { Pool } from "pg";

export const pool = new Pool({
  connectionString: "postgres://app:app@localhost:5433/shortener",
});
