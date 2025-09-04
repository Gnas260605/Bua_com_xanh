import { Router } from "express";
import "dotenv/config";

const useMySQL = (process.env.DB_DRIVER || "sqlite") === "mysql";
let db;
if (useMySQL) { ({ db } = await import("../lib/db.mysql.js")); }
else          { ({ db } = await import("../lib/db.js")); }

const router = Router();

/**
 * GET /api/foods
 * Query: q, tag, page=1, pageSize=12
 */
router.get("/", async (req, res) => {
  const { q = "", tag = "", page = 1, pageSize = 12 } = req.query;
  const off = (Number(page) - 1) * Number(pageSize);

  const where = ["status='available'", "visibility='public'"];
  const params = [];
  if (q) { where.push("(title LIKE ? OR description LIKE ?)"); params.push(`%${q}%`, `%${q}%`); }
  if (tag) {
    if (useMySQL) { where.push("JSON_SEARCH(COALESCE(tags, JSON_ARRAY()), 'one', ?) IS NOT NULL"); params.push(tag); }
    else { where.push("json_extract(tags, '$') LIKE ?"); params.push(`%${tag}%`); }
  }

  const sqlBase = `FROM food_items WHERE ${where.join(" AND ")}`;
  const listSQL = `SELECT id, title, description, qty, unit, expire_at, location_addr, lat, lng, tags, images
                   ${sqlBase} ORDER BY expire_at ASC LIMIT ? OFFSET ?`;
  const countSQL = `SELECT COUNT(*) as total ${sqlBase}`;

  let total, rows;
  if (useMySQL) {
    total = (await db.get(countSQL, params)).total;
    rows  = await db.all(listSQL, [...params, Number(pageSize), off]);
  } else {
    total = db.prepare(countSQL).get(...params).total;
    rows  = db.prepare(listSQL).all(...params, Number(pageSize), off);
  }
  rows.forEach(r => {
    try { r.tags = JSON.parse(r.tags||"[]"); } catch { r.tags=[]; }
    try { r.images = JSON.parse(r.images||"[]"); } catch { r.images=[]; }
  });
  res.json({ items: rows, page: Number(page), pageSize: Number(pageSize), total });
});

export default router;
