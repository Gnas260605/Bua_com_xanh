// src/routes/admin.pickup_points.js (ESM)
import { Router } from "express";
import "dotenv/config";

const useMySQL = (process.env.DB_DRIVER || "sqlite") === "mysql";
let db;
if (useMySQL) ({ db } = await import("../lib/db.mysql.js"));
else ({ db } = await import("../lib/db.js"));

const nowExpr = () => (useMySQL ? "NOW()" : "CURRENT_TIMESTAMP");
const router = Router();

/* =========================
   Small DB helpers
========================= */
async function dbAll(sql, params = []) {
  if (useMySQL) { const [rows] = await db.query(sql, params); return rows ?? []; }
  return db.prepare(sql).all(...params);
}
async function dbGet(sql, params = []) {
  if (useMySQL) { const [rows] = await db.query(sql, params); return rows?.[0] ?? null; }
  return db.prepare(sql).get(...params);
}
async function dbRun(sql, params = []) {
  if (useMySQL) {
    const [r] = await db.query(sql, params);
    return { lastID: r?.insertId ?? null, changes: r?.affectedRows ?? 0 };
  }
  const info = db.prepare(sql).run(...params);
  return { lastID: info.lastInsertRowid, changes: info.changes };
}

/* =========================
   Auth middleware
========================= */
function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "unauthorized" });
  if (req.user.role !== "admin") return res.status(403).json({ error: "forbidden" });
  next();
}

/* =========================
   Utils
========================= */
function toNumberOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Chuẩn hoá "opening" để lưu DB: null hoặc JSON string hợp lệ
function normalizeOpeningForStore(raw) {
  if (raw == null) return null;

  // Nếu FE gửi object → stringify
  if (typeof raw === "object") {
    try { return JSON.stringify(raw); }
    catch { return null; }
  }

  // Nếu FE gửi chuỗi
  const s = String(raw).trim();
  if (!s) return null; // chuỗi rỗng → null

  // Kiểm tra có phải JSON hợp lệ không
  try {
    JSON.parse(s);
    return s; // giữ nguyên chuỗi JSON
  } catch {
    // Không hợp lệ → dùng JSON rỗng mặc định
    return JSON.stringify({ mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] });
  }
}

// Parse JSON an toàn khi trả về client
function safeParseJSON(v, fallback = null) {
  if (v == null) return fallback;
  if (typeof v === "object") return v;
  try { return JSON.parse(v); }
  catch { return fallback; }
}

// Map 1 row để trả về FE: opening luôn là object hoặc null
function viewOf(row) {
  if (!row) return row;
  const opening = safeParseJSON(row.opening, null);
  return { ...row, opening };
}

/* =========================
   Routes
========================= */

/** GET /api/admin/pickup-points?q= */
router.get("/", requireAdmin, async (req, res) => {
  const q = (req.query.q || "").toString().trim();

  let where = "WHERE 1=1";
  const params = [];
  if (q) {
    where += " AND (name LIKE ? OR address LIKE ?)";
    params.push(`%${q}%`, `%${q}%`);
  }

  const rows = await dbAll(
    `SELECT id,name,address,lat,lng,opening,status,created_at,updated_at
     FROM pickup_points
     ${where}
     ORDER BY id DESC`,
    params
  );

  res.json(rows.map(viewOf));
});

/** POST /api/admin/pickup-points  {name,address?,lat,lng,opening?,status?} */
router.post("/", requireAdmin, async (req, res) => {
  const body = req.body || {};
  const name = (body.name || "").toString().trim();
  const address = (body.address || "").toString().trim();
  const lat = toNumberOrNull(body.lat);
  const lng = toNumberOrNull(body.lng);
  const status = (body.status || "active").toString().trim() || "active";

  if (!name) return res.status(400).json({ error: "name_required" });
  if (lat == null || lng == null) return res.status(400).json({ error: "latlng_required" });

  // opening: chấp nhận null / object / json string
  const openingForStore = normalizeOpeningForStore(body.opening);

  const { lastID } = await dbRun(
    `INSERT INTO pickup_points(name,address,lat,lng,opening,status,created_at,updated_at)
     VALUES (?,?,?,?,?, ?, ${nowExpr()}, ${nowExpr()})`,
    [name, address, lat, lng, openingForStore, status]
  );

  // id hiện là AUTO_INCREMENT (số)
  const row = await dbGet(`SELECT * FROM pickup_points WHERE id = ?`, [lastID]);
  res.json(viewOf(row));
});

/** PATCH /api/admin/pickup-points/:id */
router.patch("/:id", requireAdmin, async (req, res) => {
  const id = toNumberOrNull(req.params.id);
  if (id == null) return res.status(400).json({ error: "invalid_id" });

  const cur = await dbGet(`SELECT * FROM pickup_points WHERE id=?`, [id]);
  if (!cur) return res.status(404).json({ error: "not_found" });

  const updatable = ["name", "address", "lat", "lng", "opening", "status"];
  const set = [];
  const params = [];

  for (const k of updatable) {
    if (Object.prototype.hasOwnProperty.call(req.body, k)) {
      if (k === "lat" || k === "lng") {
        const n = toNumberOrNull(req.body[k]);
        if (n == null) return res.status(400).json({ error: `invalid_${k}` });
        set.push(`${k}=?`); params.push(n);
      } else if (k === "opening") {
        set.push("opening=?"); params.push(normalizeOpeningForStore(req.body.opening));
      } else {
        const v = req.body[k] == null ? "" : String(req.body[k]).trim();
        set.push(`${k}=?`); params.push(v);
      }
    }
  }

  if (!set.length) return res.status(400).json({ error: "no_fields" });

  await dbRun(
    `UPDATE pickup_points SET ${set.join(", ")}, updated_at=${nowExpr()} WHERE id=?`,
    [...params, id]
  );

  const row = await dbGet(`SELECT * FROM pickup_points WHERE id=?`, [id]);
  res.json(viewOf(row));
});

/** DELETE /api/admin/pickup-points/:id */
router.delete("/:id", requireAdmin, async (req, res) => {
  const id = toNumberOrNull(req.params.id);
  if (id == null) return res.status(400).json({ error: "invalid_id" });

  await dbRun(`DELETE FROM pickup_points WHERE id=?`, [id]);
  res.json({ ok: true });
});

export default router;
