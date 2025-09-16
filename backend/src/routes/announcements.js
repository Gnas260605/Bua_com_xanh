// src/routes/announcements.js
import { Router } from "express";
import "dotenv/config";

const useMySQL = (process.env.DB_DRIVER || "sqlite") === "mysql";
let db;
if (useMySQL) {
  ({ db } = await import("../lib/db.mysql.js"));
} else {
  ({ db } = await import("../lib/db.js"));
}

const router = Router();

/* helpers */
async function dbAll(sql, params = []) {
  if (useMySQL) {
    if (typeof db.all === "function") return await db.all(sql, params);
    if (typeof db.query === "function") {
      const [rows] = await db.query(sql, params);
      return rows ?? [];
    }
    throw new Error("MySQL adapter missing .all/.query");
  }
  return db.prepare(sql).all(...params);
}
async function dbGet(sql, params = []) {
  if (useMySQL) {
    if (typeof db.get === "function") return await db.get(sql, params);
    if (typeof db.query === "function") {
      const [rows] = await db.query(sql, params);
      return rows?.[0] ?? null;
    }
    throw new Error("MySQL adapter missing .get/.query");
  }
  return db.prepare(sql).get(...params);
}
const toInt = (v, d, min = -Infinity, max = Infinity) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : d;
};
function normalize(row) {
  return {
    id: row.id,
    title: row.title ?? "Thông báo",
    body: row.content ?? row.body ?? "",
    created_at: row.created_at ?? row.updated_at ?? new Date().toISOString(),
    level: (row.level ?? "info").toString(),
    active: Number(row.active ?? 1) === 1,
    url: row.url || "",
  };
}

/** GET /api/announcements?active=1&limit=20&order=desc */
router.get("/", async (req, res) => {
  try {
    const activeRaw = (req.query.active ?? "1").toString().toLowerCase();
    const filterActive = activeRaw === "1" || activeRaw === "true" || activeRaw === "yes";
    const limit = toInt(req.query.limit, 20, 1, 100);
    const order = String(req.query.order || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";
    const where = filterActive ? "WHERE COALESCE(active,1)=1" : "";

    let rows = [];
    try {
      rows = await dbAll(
        `SELECT id, title, content, level, active, created_at, updated_at, url
         FROM announcements
         ${where}
         ORDER BY COALESCE(created_at, updated_at) ${order}
         LIMIT ?`,
        [limit]
      );
    } catch {
      rows = await dbAll(
        `SELECT id, title, content, level, active, created_at, updated_at, NULL AS url
         FROM announcements
         ${where}
         ORDER BY COALESCE(created_at, updated_at) ${order}
         LIMIT ?`,
        [limit]
      );
    }
    res.json({ ok: true, items: rows.map(normalize) });
  } catch (e) {
    console.error("[GET /api/announcements] error:", e?.message || e);
    res.status(500).json({ ok: false, message: "Không lấy được thông báo" });
  }
});

/** NEW: GET /api/announcements/:id – lấy chi tiết đầy đủ theo id */
router.get("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    let row = null;
    try {
      row = await dbGet(
        `SELECT id, title, content, level, active, created_at, updated_at, url
         FROM announcements WHERE id=?`,
        [id]
      );
    } catch {
      row = await dbGet(
        `SELECT id, title, content, level, active, created_at, updated_at, NULL AS url
         FROM announcements WHERE id=?`,
        [id]
      );
    }
    if (!row) return res.status(404).json({ ok: false, message: "Not found" });
    res.json({ ok: true, item: normalize(row) });
  } catch (e) {
    console.error("[GET /api/announcements/:id] error:", e?.message || e);
    res.status(500).json({ ok: false, message: "Không lấy được chi tiết thông báo" });
  }
});

/** (optional) đếm nhanh */
router.get("/count", async (_req, res) => {
  try {
    const [r] = await dbAll(
      "SELECT COUNT(*) AS c FROM announcements WHERE COALESCE(active,1)=1 LIMIT 1"
    );
    res.json({ ok: true, count: Number(r?.c || 0) });
  } catch {
    res.json({ ok: true, count: 0 });
  }
});

/** (optional) mark-read server-side */
router.post("/mark-read", async (_req, res) => res.json({ ok: true }));

export default router;
