import express from "express";
import { toBase62 } from "./base62";
import { pool } from "./db";
import { Snowflake } from "./snowflake";

const snowflake = new Snowflake(Number(process.env.MACHINE_ID ?? 1));

function isValidUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

export const app = express();
app.use(express.json());

app.post("/api/links", async (req, res) => {
  const { url } = req.body ?? {};

  if (!isValidUrl(url)) {
    res.status(400).json({ error: "A valid http or https URL is required" });
    return;
  }

  const id = snowflake.nextId();
  const code = toBase62(id);

  await pool.query(
    "INSERT INTO links (id, code, long_url) VALUES ($1, $2, $3)",
    [id.toString(), code, url],
  );

  res.status(201).json({ code, shortUrl: `http://localhost:3000/${code}` });
});

app.get("/:code", async (req, res) => {
  const result = await pool.query(
    "SELECT long_url FROM links WHERE code = $1",
    [req.params.code],
  );

  if (result.rowCount === 0) {
    res.status(404).json({ error: "Link not found" });
    return;
  }

  res.redirect(302, result.rows[0].long_url);
});
