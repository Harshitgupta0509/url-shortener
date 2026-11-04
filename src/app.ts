import express from "express";
import { toBase62 } from "./base62";
import { addToBloom, mightExist } from "./bloom";
import { cacheUrl, getCachedUrl } from "./cache";
import { pool } from "./db";
import { trackClick } from "./events";
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

  await addToBloom(code);

  res.status(201).json({ code, shortUrl: `http://localhost:3000/${code}` });
});

app.get("/api/links/:code/stats", async (req, res) => {
  const { code } = req.params;

  const link = await pool.query("SELECT 1 FROM links WHERE code = $1", [code]);

  if (link.rowCount === 0) {
    res.status(404).json({ error: "Link not found" });
    return;
  }

  const [total, byCountry, byDevice] = await Promise.all([
    pool.query("SELECT COUNT(*)::int AS clicks FROM clicks WHERE code = $1", [
      code,
    ]),
    pool.query(
      `SELECT country, COUNT(*)::int AS clicks
       FROM clicks WHERE code = $1
       GROUP BY country ORDER BY clicks DESC`,
      [code],
    ),
    pool.query(
      `SELECT device, COUNT(*)::int AS clicks
       FROM clicks WHERE code = $1
       GROUP BY device ORDER BY clicks DESC`,
      [code],
    ),
  ]);

  res.json({
    code,
    totalClicks: total.rows[0].clicks,
    byCountry: byCountry.rows,
    byDevice: byDevice.rows,
  });
});

app.get("/:code", async (req, res) => {
  const { code } = req.params;

  if (!(await mightExist(code))) {
    res.set("X-Bloom", "BLOCKED").status(404).json({ error: "Link not found" });
    return;
  }

  const cachedUrl = await getCachedUrl(code);

  if (cachedUrl) {
    trackClick(code, req.get("user-agent"), req.get("x-country"));
    res.set("X-Cache", "HIT").redirect(302, cachedUrl);
    return;
  }

  const result = await pool.query(
    "SELECT long_url FROM links WHERE code = $1",
    [code],
  );

  if (result.rowCount === 0) {
    res.status(404).json({ error: "Link not found" });
    return;
  }

  const longUrl: string = result.rows[0].long_url;
  await cacheUrl(code, longUrl);
  trackClick(code, req.get("user-agent"), req.get("x-country"));

  res.set("X-Cache", "MISS").redirect(302, longUrl);
});
