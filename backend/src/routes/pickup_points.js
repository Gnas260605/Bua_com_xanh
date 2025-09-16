// backend/src/routes/pickup_points.js
import { Router } from "express";
import jwt from "jsonwebtoken";
import "dotenv/config";

const useMySQL = (process.env.DB_DRIVER || "sqlite") === "mysql";
let db;
if (useMySQL) ({ db } = await import("../lib/db.mysql.js"));
else ({ db } = await import("../lib/db.js"));

const router = Router();

/* =================== Utils & helpers =================== */
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const nowExpr = () => (useMySQL ? "NOW()" : "CURRENT_TIMESTAMP");

function attachUserFromJWT(req, _res, next) {
  try {
    const h = req.headers.authorization || "";
    const m = h.match(/^Bearer\s+(.+)$/i);
    if (m) req.user = jwt.verify(m[1], JWT_SECRET); // {id,email,role}
  } catch {}
  next();
}
function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "unauthorized" });
  if (req.user.role !== "admin") return res.status(403).json({ error: "forbidden" });
  next();
}
router.use(attachUserFromJWT);

async function dbGet(sql, params = []) {
  if (useMySQL) { const [rows] = await db.query(sql, params); return rows?.[0] ?? null; }
  return db.prepare(sql).get(...params);
}
async function dbAll(sql, params = []) {
  if (useMySQL) { const [rows] = await db.query(sql, params); return rows ?? []; }
  return db.prepare(sql).all(...params);
}
async function dbRun(sql, params = []) {
  if (useMySQL) { const [r] = await db.query(sql, params); return { lastID: r?.insertId ?? 0, changes: r?.affectedRows ?? 0 }; }
  const info = db.prepare(sql).run(...params);
  return { lastID: info.lastInsertRowid, changes: info.changes };
}

/** Chuẩn hoá opening để lưu DB:
 * - null/""  -> NULL
 * - object   -> JSON.stringify
 * - string JSON-hợp-lệ -> giữ nguyên
 * - string thường:
 *    - MySQL(JSON)  -> bọc thành JSON string: JSON.stringify(s)
 *    - SQLite(TEXT) -> lưu nguyên văn
 */
function normalizeOpeningForDB(opening) {
  if (opening == null) return null;
  if (typeof opening === "object") {
    try { return JSON.stringify(opening); } catch { return null; }
  }
  if (typeof opening === "string") {
    const s = opening.trim();
    if (!s) return null;
    if (useMySQL) {
      try { JSON.parse(s); return s; } catch { return JSON.stringify(s); }
    }
    // sqlite TEXT
    return s;
  }
  return null;
}

/* =================== Ensure schema (idempotent) =================== */
async function ensureSchema() {
  if (useMySQL) {
    // Bảng cơ bản
    await db.query(`
      CREATE TABLE IF NOT EXISTS pickup_points (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        address VARCHAR(255),
        lat DOUBLE NULL,
        lng DOUBLE NULL,
        opening JSON NULL,
        status ENUM('active','inactive') NOT NULL DEFAULT 'active',
        created_at DATETIME NOT NULL DEFAULT NOW(),
        updated_at DATETIME NOT NULL DEFAULT NOW() ON UPDATE NOW(),
        INDEX(name), INDEX(status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    // Bổ sung cột nếu thiếu (an toàn, KHÔNG đụng id do có thể có FK)
    await db.query(`ALTER TABLE pickup_points ADD COLUMN IF NOT EXISTS address VARCHAR(255)`);
    await db.query(`ALTER TABLE pickup_points ADD COLUMN IF NOT EXISTS lat DOUBLE NULL`);
    await db.query(`ALTER TABLE pickup_points ADD COLUMN IF NOT EXISTS lng DOUBLE NULL`);
    await db.query(`ALTER TABLE pickup_points ADD COLUMN IF NOT EXISTS opening JSON NULL`);
    await db.query(`ALTER TABLE pickup_points ADD COLUMN IF NOT EXISTS status ENUM('active','inactive') NOT NULL DEFAULT 'active'`);
    await db.query(`ALTER TABLE pickup_points ADD COLUMN IF NOT EXISTS created_at DATETIME NOT NULL DEFAULT NOW()`);
    await db.query(`ALTER TABLE pickup_points ADD COLUMN IF NOT EXISTS updated_at DATETIME NOT NULL DEFAULT NOW() ON UPDATE NOW()`);
  } else {
    await dbRun(`
      CREATE TABLE IF NOT EXISTS pickup_points (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        address TEXT,
        lat REAL,
        lng REAL,
        opening TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL DEFAULT (${nowExpr()}),
        updated_at TEXT NOT NULL DEFAULT (${nowExpr()})
      )
    `);
    // SQLite: thêm cột nếu thiếu
    const cols = await dbAll(`PRAGMA table_info(pickup_points)`);
    const has = (n) => cols.some((c) => c.name === n);
    if (!has("address"))   await dbRun(`ALTER TABLE pickup_points ADD COLUMN address TEXT`);
    if (!has("lat"))       await dbRun(`ALTER TABLE pickup_points ADD COLUMN lat REAL`);
    if (!has("lng"))       await dbRun(`ALTER TABLE pickup_points ADD COLUMN lng REAL`);
    if (!has("opening"))   await dbRun(`ALTER TABLE pickup_points ADD COLUMN opening TEXT`);
    if (!has("status"))    await dbRun(`ALTER TABLE pickup_points ADD COLUMN status TEXT NOT NULL DEFAULT 'active'`);
    if (!has("created_at"))await dbRun(`ALTER TABLE pickup_points ADD COLUMN created_at TEXT NOT NULL DEFAULT (${nowExpr()})`);
    if (!has("updated_at"))await dbRun(`ALTER TABLE pickup_points ADD COLUMN updated_at TEXT NOT NULL DEFAULT (${nowExpr()})`);
  }
}
await ensureSchema();

/* =================== Routes =================== */

/** GET /api/admin/pickup-points?q= */
router.get("/api/admin/pickup-points", requireAdmin, async (req, res) => {
  const q = (req.query.q || "").toString().trim();
  const like = `%${q}%`;
  const rows = q
    ? await dbAll(
        `SELECT id,name,address,lat,lng,opening,status,created_at,updated_at
         FROM pickup_points
         WHERE name LIKE ? OR address LIKE ?
         ORDER BY id DESC`,
        [like, like]
      )
    : await dbAll(
        `SELECT id,name,address,lat,lng,opening,status,created_at,updated_at
         FROM pickup_points
         ORDER BY id DESC`
      );
  res.json(rows);
});

/** POST /api/admin/pickup-points  {name,address?,lat?,lng?,opening?,status?} */
router.post("/api/admin/pickup-points", requireAdmin, async (req, res) => {
  const { name, address = "", lat = null, lng = null, status = "active" } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: "name_required" });

  const opening = normalizeOpeningForDB(req.body?.opening);
  const latNum = lat == null || lat === "" ? null : Number(lat);
  const lngNum = lng == null || lng === "" ? null : Number(lng);

  try {
    const { lastID } = await dbRun(
      `INSERT INTO pickup_points(name,address,lat,lng,opening,status,created_at,updated_at)
       VALUES (?,?,?,?,?, ?, ${nowExpr()}, ${nowExpr()})`,
      [name.trim(), address, latNum, lngNum, opening, status]
    );
    const row = await dbGet(`SELECT * FROM pickup_points WHERE id=?`, [lastID]);
    res.json(row);
  } catch (e) {
    // Nếu vi phạm FK khi bảng khác tham chiếu (xoá/insert sai...), trả về thông báo rõ ràng
    return res.status(400).json({ error: "insert_failed", message: String(e?.sqlMessage || e?.message || e) });
  }
});

/** PATCH /api/admin/pickup-points/:id  (cập nhật từng phần) */
router.patch("/api/admin/pickup-points/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const cur = await dbGet(`SELECT * FROM pickup_points WHERE id=?`, [id]);
  if (!cur) return res.status(404).json({ error: "not_found" });

  const fields = ["name","address","lat","lng","opening","status"];
  const set = [];
  const params = [];

  for (const k of fields) {
    if (req.body[k] !== undefined) {
      let v = req.body[k];
      if (k === "lat" || k === "lng") {
        v = (v == null || v === "") ? null : Number(v);
      } else if (k === "opening") {
        v = normalizeOpeningForDB(v);
      }
      set.push(`${k} = ?`);
      params.push(v);
    }
  }
  if (!set.length) return res.status(400).json({ error: "no_fields" });

  set.push(`updated_at = ${nowExpr()}`);
  try {
    await dbRun(`UPDATE pickup_points SET ${set.join(", ")} WHERE id=?`, [...params, id]);
    const row = await dbGet(`SELECT * FROM pickup_points WHERE id=?`, [id]);
    res.json(row);
  } catch (e) {
    return res.status(400).json({ error: "update_failed", message: String(e?.sqlMessage || e?.message || e) });
  }
});

/** DELETE /api/admin/pickup-points/:id */
router.delete("/api/admin/pickup-points/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  try {
    await dbRun(`DELETE FROM pickup_points WHERE id=?`, [id]);
    res.json({ ok: true });
  } catch (e) {
    // có thể bị chặn do FK (ví dụ bookings.pickup_point)
    return res.status(409).json({
      error: "has_dependencies",
      message: "Không thể xoá vì đang được tham chiếu.",
    });
  }
});

/* =================== Error handler =================== */
router.use((err, _req, res, _next) => {
  console.error("[pickup_points] error:", err);
  res.status(500).json({ error: "internal_error" });
});

export default router;
