// backend/src/routes/deliveries.js  (ESM, secure, schema-safe)
import { Router } from "express";
import jwt from "jsonwebtoken";
import "dotenv/config";

const useMySQL = (process.env.DB_DRIVER || "sqlite") === "mysql";
let db;
if (useMySQL) ({ db } = await import("../lib/db.mysql.js"));
else ({ db } = await import("../lib/db.js"));

export const deliveriesRouter = Router();

/* ============================================================
   Utilities
============================================================ */
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const ROLES = { ADMIN: "admin", SHIPPER: "shipper", USER: "user" };

// Hỗ trợ alias 'picking' => 'in_progress'
const STATUS_CANON = new Map([
  ["pending", "pending"],
  ["assigned", "assigned"],
  ["in_progress", "in_progress"],
  ["picking", "in_progress"],
  ["delivered", "delivered"],
  ["cancelled", "cancelled"],
]);
const STATUS_SET = new Set(STATUS_CANON.keys());

const safeInt = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
const nowExpr = () => (useMySQL ? "NOW()" : "CURRENT_TIMESTAMP");
const jsonStringifyOrNull = (v) => {
  try { return v == null ? null : JSON.stringify(v); } catch { return null; }
};

/* ============================================================
   DB helpers (driver-agnostic)
============================================================ */
async function dbGet(sql, params = []) {
  if (useMySQL) {
    if (typeof db.get === "function") return await db.get(sql, params);
    const [rows] = await db.query(sql, params);
    return rows?.[0] ?? null;
  }
  return db.prepare(sql).get(...params);
}
async function dbAll(sql, params = []) {
  if (useMySQL) {
    if (typeof db.all === "function") return await db.all(sql, params);
    const [rows] = await db.query(sql, params);
    return rows ?? [];
  }
  return db.prepare(sql).all(...params);
}
async function dbRun(sql, params = []) {
  if (useMySQL) {
    const [res] = await db.query(sql, params);
    return { lastID: res?.insertId, changes: res?.affectedRows };
  }
  const stmt = db.prepare(sql);
  const info = stmt.run(...params);
  return { lastID: info.lastInsertRowid, changes: info.changes };
}

/* ============================================================
   Schema bootstrap (idempotent & self-healing)
   → Tạo bảng nếu thiếu & tự bổ sung cột mới nếu bảng cũ
============================================================ */
async function ensureSchema() {
  if (useMySQL) {
    // Bảng deliveries tối thiểu
    await db.query(`
      CREATE TABLE IF NOT EXISTS deliveries (
        id            INT AUTO_INCREMENT PRIMARY KEY,
        booking_id    INT NOT NULL,
        shipper_id    INT NULL,
        status        VARCHAR(32) NOT NULL DEFAULT 'pending',
        otp_code      VARCHAR(16) NULL,
        proof_images  LONGTEXT NULL,
        route_geojson LONGTEXT NULL,
        created_at    DATETIME NOT NULL DEFAULT NOW(),
        updated_at    DATETIME NOT NULL DEFAULT NOW() ON UPDATE NOW()
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Bổ sung cột còn thiếu (MySQL 8+ hỗ trợ IF NOT EXISTS)
    await db.query(`ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS qty INT NOT NULL DEFAULT 1 AFTER shipper_id;`);
    await db.query(`ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS current_lat DOUBLE NULL AFTER route_geojson;`);
    await db.query(`ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS current_lng DOUBLE NULL AFTER current_lat;`);

    // Bảng chứng từ
    await db.query(`
      CREATE TABLE IF NOT EXISTS delivery_proofs (
        id           INT AUTO_INCREMENT PRIMARY KEY,
        delivery_id  INT NOT NULL,
        images       LONGTEXT NULL,
        note         TEXT NULL,
        created_at   DATETIME NOT NULL DEFAULT NOW()
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Bảng bookings tối thiểu
    await db.query(`CREATE TABLE IF NOT EXISTS bookings ( id INT AUTO_INCREMENT PRIMARY KEY ) ENGINE=InnoDB;`);
  } else {
    // SQLite
    await dbRun(`
      CREATE TABLE IF NOT EXISTS deliveries (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        booking_id    INTEGER NOT NULL,
        shipper_id    INTEGER,
        status        TEXT NOT NULL DEFAULT 'pending',
        otp_code      TEXT,
        proof_images  TEXT,
        route_geojson TEXT,
        created_at    TEXT NOT NULL DEFAULT (${nowExpr()}),
        updated_at    TEXT NOT NULL DEFAULT (${nowExpr()})
      )
    `);

    // Thêm cột nếu thiếu bằng PRAGMA
    const cols = await dbAll(`PRAGMA table_info(deliveries)`);
    const has = (name) => cols.some((c) => c.name === name);
    if (!has("qty"))         await dbRun(`ALTER TABLE deliveries ADD COLUMN qty INTEGER NOT NULL DEFAULT 1`);
    if (!has("current_lat")) await dbRun(`ALTER TABLE deliveries ADD COLUMN current_lat REAL`);
    if (!has("current_lng")) await dbRun(`ALTER TABLE deliveries ADD COLUMN current_lng REAL`);

    await dbRun(`
      CREATE TABLE IF NOT EXISTS delivery_proofs (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        delivery_id  INTEGER NOT NULL,
        images       TEXT,
        note         TEXT,
        created_at   TEXT NOT NULL DEFAULT (${nowExpr()})
      )
    `);
    await dbRun(`CREATE TABLE IF NOT EXISTS bookings ( id INTEGER PRIMARY KEY AUTOINCREMENT )`);
  }
}
await ensureSchema();

/* ============================================================
   Security middlewares
============================================================ */
function attachUserFromJWT(req, _res, next) {
  try {
    const h = req.headers.authorization || "";
    const m = h.match(/^Bearer\s+(.+)$/i);
    if (m) req.user = jwt.verify(m[1], JWT_SECRET); // {id,email,role}
  } catch { /* ignore */ }
  next();
}
function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "unauthorized" });
  next();
}
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "unauthorized" });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: "forbidden" });
    next();
  };
}
function asyncWrap(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
deliveriesRouter.use(attachUserFromJWT);

/* ============================================================
   ADMIN ENDPOINTS
============================================================ */

/** GET /api/admin/deliveries?status=&q=&page=&pageSize= */
deliveriesRouter.get(
  "/api/admin/deliveries",
  requireAuth,
  requireRole(ROLES.ADMIN),
  asyncWrap(async (req, res) => {
    const rawStatus = (req.query.status || "").trim();
    const status = rawStatus ? (STATUS_CANON.get(rawStatus) || null) : "";
    const q = (req.query.q || "").trim();
    const page = Math.max(1, safeInt(req.query.page, 1));
    const pageSize = Math.min(100, Math.max(1, safeInt(req.query.pageSize, 30)));
    const offset = (page - 1) * pageSize;

    let where = "WHERE 1=1";
    const params = [];

    if (status) {
      where += " AND status = ?";
      params.push(status);
    } else if (rawStatus && !status) {
      return res.status(400).json({ error: "invalid status" });
    }

    if (q) {
      if (useMySQL) where += " AND (CAST(id AS CHAR) LIKE ? OR CAST(booking_id AS CHAR) LIKE ? OR CAST(shipper_id AS CHAR) LIKE ?)";
      else          where += " AND (id LIKE ? OR booking_id LIKE ? OR shipper_id LIKE ?)";
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }

    const items = await dbAll(
      `SELECT id, booking_id, shipper_id, qty, status, otp_code,
              proof_images, route_geojson, current_lat, current_lng,
              created_at, updated_at
       FROM deliveries
       ${where}
       ORDER BY id DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );
    const totalRow = await dbGet(`SELECT COUNT(*) AS c FROM deliveries ${where}`, params);
    res.json({ items, total: totalRow?.c ?? 0, page, pageSize });
  })
);

/** GET /api/admin/deliveries/:id */
deliveriesRouter.get(
  "/api/admin/deliveries/:id",
  requireAuth,
  requireRole(ROLES.ADMIN),
  asyncWrap(async (req, res) => {
    const id = safeInt(req.params.id);
    const row = await dbGet("SELECT * FROM deliveries WHERE id = ?", [id]);
    if (!row) return res.status(404).json({ error: "not_found" });
    res.json(row);
  })
);

/** POST /api/admin/deliveries/create  { booking_id?, shipper_id?, qty? }
 *  - Nếu không có booking_id: tự tạo booking rỗng, sau đó tạo delivery
 *  - Nếu có shipper_id: set status='assigned' và gán shipper luôn
 */
deliveriesRouter.post(
  "/api/admin/deliveries/create",
  requireAuth,
  requireRole(ROLES.ADMIN),
  asyncWrap(async (req, res) => {
    let booking_id = safeInt(req.body?.booking_id, 0);
    const qty = Math.max(1, safeInt(req.body?.qty, 1));
    const shipper_id = safeInt(req.body?.shipper_id, 0);

    // Tự tạo booking rỗng nếu không truyền
    if (!booking_id) {
      try {
        if (useMySQL) {
          const { lastID } = await dbRun(`INSERT INTO bookings () VALUES ()`);
          booking_id = lastID;
        } else {
          const { lastID } = await dbRun(`INSERT INTO bookings DEFAULT VALUES`);
          booking_id = lastID;
        }
      } catch {
        // Fallback cho MySQL cũ
        const { lastID } = await dbRun(`INSERT INTO bookings (id) VALUES (NULL)`);
        booking_id = lastID;
      }
    } else {
      const booking = await dbGet("SELECT id FROM bookings WHERE id = ?", [booking_id]);
      if (!booking) return res.status(404).json({ error: "booking_not_found" });
    }

    // 1 booking chỉ có 1 delivery
    const exists = await dbGet("SELECT * FROM deliveries WHERE booking_id = ?", [booking_id]);
    if (exists) return res.json(exists);

    const initialStatus = shipper_id ? "assigned" : "pending";

    const { lastID } = await dbRun(
      `INSERT INTO deliveries (booking_id, shipper_id, qty, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ${nowExpr()}, ${nowExpr()})`,
      [booking_id, shipper_id || null, qty, initialStatus]
    );
    const created = await dbGet("SELECT * FROM deliveries WHERE id = ?", [lastID]);
    res.json(created);
  })
);

/** POST /api/admin/deliveries/assign { booking_id, shipper_id } */
deliveriesRouter.post(
  "/api/admin/deliveries/assign",
  requireAuth,
  requireRole(ROLES.ADMIN),
  asyncWrap(async (req, res) => {
    const booking_id = safeInt(req.body?.booking_id);
    const shipper_id = safeInt(req.body?.shipper_id);
    if (!booking_id || !shipper_id)
      return res.status(400).json({ error: "booking_id_and_shipper_id_required" });

    let del = await dbGet("SELECT * FROM deliveries WHERE booking_id = ?", [booking_id]);
    if (!del) {
      const insert = await dbRun(
        `INSERT INTO deliveries (booking_id, shipper_id, status, created_at, updated_at)
         VALUES (?, ?, 'assigned', ${nowExpr()}, ${nowExpr()})`,
        [booking_id, shipper_id]
      );
      del = await dbGet("SELECT * FROM deliveries WHERE id = ?", [insert.lastID]);
    } else {
      await dbRun(
        `UPDATE deliveries SET shipper_id=?, status='assigned', updated_at=${nowExpr()} WHERE id=?`,
        [shipper_id, del.id]
      );
      del = await dbGet("SELECT * FROM deliveries WHERE id = ?", [del.id]);
    }
    res.json(del);
  })
);

/** PATCH /api/admin/deliveries/:id
 * body: { status?, shipper_id?, qty?, route_geojson?, proof_images?, otp_code?, current_lat?, current_lng? }
 */
deliveriesRouter.patch(
  "/api/admin/deliveries/:id",
  requireAuth,
  requireRole(ROLES.ADMIN),
  asyncWrap(async (req, res) => {
    const id = safeInt(req.params.id);
    if (!id) return res.status(400).json({ error: "invalid_id" });

    let nextStatus;
    if (req.body.status !== undefined) {
      const s = String(req.body.status).trim();
      if (!STATUS_SET.has(s)) return res.status(400).json({ error: "invalid_status" });
      nextStatus = STATUS_CANON.get(s);
    }

    const allowed = ["shipper_id", "qty", "route_geojson", "proof_images", "otp_code", "current_lat", "current_lng"];
    const set = [];
    const params = [];

    if (nextStatus !== undefined) { set.push("status = ?"); params.push(nextStatus); }

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        if (key === "qty") params.push(Math.max(1, safeInt(req.body[key], 1)));
        else if (key === "route_geojson" || key === "proof_images") params.push(jsonStringifyOrNull(req.body[key]));
        else params.push(req.body[key]);
        set.push(`${key} = ?`);
      }
    }

    if (!set.length) return res.status(400).json({ error: "no_updatable_fields" });

    set.push(`updated_at = ${nowExpr()}`);
    await dbRun(`UPDATE deliveries SET ${set.join(", ")} WHERE id=?`, [...params, id]);

    const row = await dbGet("SELECT * FROM deliveries WHERE id = ?", [id]);
    res.json(row);
  })
);

/** POST /api/admin/deliveries/:id/cancel { reason? } */
deliveriesRouter.post(
  "/api/admin/deliveries/:id/cancel",
  requireAuth,
  requireRole(ROLES.ADMIN),
  asyncWrap(async (req, res) => {
    const id = safeInt(req.params.id);
    const d = await dbGet("SELECT * FROM deliveries WHERE id=?", [id]);
    if (!d) return res.status(404).json({ error: "not_found" });
    if (d.status === "delivered") return res.status(409).json({ error: "already_delivered" });

    await dbRun(`UPDATE deliveries SET status='cancelled', updated_at=${nowExpr()} WHERE id=?`, [id]);
    const row = await dbGet("SELECT * FROM deliveries WHERE id=?", [id]);
    res.json(row);
  })
);

/* ============================================================
   SHIPPER ENDPOINTS
============================================================ */

/** GET /api/shippers/deliveries/available */
deliveriesRouter.get(
  "/api/shippers/deliveries/available",
  requireAuth,
  requireRole(ROLES.SHIPPER, ROLES.ADMIN),
  asyncWrap(async (_req, res) => {
    const items = await dbAll(
      `SELECT * FROM deliveries
       WHERE status='pending'
          OR (status='assigned' AND (shipper_id IS NULL OR shipper_id = 0))
       ORDER BY id DESC`
    );
    res.json(items);
  })
);

/** POST /api/shippers/deliveries/claim  { delivery_id } */
deliveriesRouter.post(
  "/api/shippers/deliveries/claim",
  requireAuth,
  requireRole(ROLES.SHIPPER, ROLES.ADMIN),
  asyncWrap(async (req, res) => {
    const delivery_id = safeInt(req.body?.delivery_id);
    if (!delivery_id) return res.status(400).json({ error: "delivery_id_required" });

    const shipper_id = req.user?.id;
    if (!shipper_id) return res.status(401).json({ error: "unauthorized" });

    const d = await dbGet("SELECT * FROM deliveries WHERE id = ?", [delivery_id]);
    if (!d) return res.status(404).json({ error: "not_found" });
    if (d.shipper_id && d.shipper_id !== shipper_id)
      return res.status(409).json({ error: "already_assigned" });

    await dbRun(
      `UPDATE deliveries
       SET shipper_id=?, status='assigned', updated_at=${nowExpr()}
       WHERE id=?`,
      [shipper_id, delivery_id]
    );
    const row = await dbGet("SELECT * FROM deliveries WHERE id = ?", [delivery_id]);
    res.json(row);
  })
);

/** PATCH /api/shippers/deliveries/:id/status  { status, otp_code? } */
deliveriesRouter.patch(
  "/api/shippers/deliveries/:id/status",
  requireAuth,
  requireRole(ROLES.SHIPPER, ROLES.ADMIN),
  asyncWrap(async (req, res) => {
    const id = safeInt(req.params.id);
    let { status, otp_code } = req.body || {};
    if (!id || !status) return res.status(400).json({ error: "id_and_status_required" });

    if (!STATUS_SET.has(status)) return res.status(400).json({ error: "invalid_status" });
    status = STATUS_CANON.get(status);

    const d = await dbGet("SELECT * FROM deliveries WHERE id=?", [id]);
    if (!d) return res.status(404).json({ error: "not_found" });

    if (req.user.role !== ROLES.ADMIN && d.shipper_id !== req.user.id) {
      return res.status(403).json({ error: "not_your_delivery" });
    }

    if (status === "delivered" && d.otp_code) {
      if (!otp_code || String(otp_code) !== String(d.otp_code)) {
        return res.status(400).json({ error: "invalid_otp" });
      }
    }

    await dbRun(
      `UPDATE deliveries SET status=?, updated_at=${nowExpr()} WHERE id=?`,
      [status, id]
    );
    const row = await dbGet("SELECT * FROM deliveries WHERE id = ?", [id]);
    res.json(row);
  })
);

/* ============================================================
   OTP & PROOFS
============================================================ */

/** POST /api/deliveries/:id/generate-otp  */
deliveriesRouter.post(
  "/api/deliveries/:id/generate-otp",
  requireAuth,
  requireRole(ROLES.ADMIN, ROLES.SHIPPER),
  asyncWrap(async (req, res) => {
    const id = safeInt(req.params.id);
    const d = await dbGet("SELECT * FROM deliveries WHERE id=?", [id]);
    if (!d) return res.status(404).json({ error: "not_found" });

    if (req.user.role === ROLES.SHIPPER && d.shipper_id !== req.user.id) {
      return res.status(403).json({ error: "not_your_delivery" });
    }

    const digits = "0123456789";
    let otp = "";
    for (let i = 0; i < 6; i++) otp += digits[Math.floor(Math.random() * 10)];

    await dbRun(
      `UPDATE deliveries SET otp_code=?, updated_at=${nowExpr()} WHERE id=?`,
      [otp, id]
    );

    // NOTE: production nên gửi OTP qua SMS/Email, không trả thẳng
    res.json({ id, otp });
  })
);

/** POST /api/deliveries/:id/verify-otp  { otp_code } */
deliveriesRouter.post(
  "/api/deliveries/:id/verify-otp",
  requireAuth,
  asyncWrap(async (req, res) => {
    const id = safeInt(req.params.id);
    const otp_code = String(req.body?.otp_code || "");
    if (!otp_code) return res.status(400).json({ error: "otp_code_required" });

    const d = await dbGet("SELECT * FROM deliveries WHERE id=?", [id]);
    if (!d) return res.status(404).json({ error: "not_found" });

    const ok = d.otp_code && String(d.otp_code) === otp_code;
    res.json({ id, ok });
  })
);

/** POST /api/deliveries/:id/proofs  { images?: string[] | JSON, note?: string } */
deliveriesRouter.post(
  "/api/deliveries/:id/proofs",
  requireAuth,
  requireRole(ROLES.ADMIN, ROLES.SHIPPER),
  asyncWrap(async (req, res) => {
    const id = safeInt(req.params.id);
    const d = await dbGet("SELECT * FROM deliveries WHERE id=?", [id]);
    if (!d) return res.status(404).json({ error: "not_found" });

    if (req.user.role === ROLES.SHIPPER && d.shipper_id !== req.user.id) {
      return res.status(403).json({ error: "not_your_delivery" });
    }

    const images = Array.isArray(req.body?.images) ? req.body.images : null;
    const note = req.body?.note || null;

    await dbRun(
      `INSERT INTO delivery_proofs (delivery_id, images, note)
       VALUES (?, ?, ?)`,
      [id, jsonStringifyOrNull(images), note]
    );

    if (images?.length) {
      await dbRun(
        `UPDATE deliveries SET proof_images=?, updated_at=${nowExpr()} WHERE id=?`,
        [jsonStringifyOrNull(images), id]
      );
    }

    res.json({ ok: true });
  })
);

/* ============================================================
   Error handler
============================================================ */
deliveriesRouter.use((err, _req, res, _next) => {
  console.error("[deliveries] error:", err);
  res.status(500).json({ error: "internal_error" });
});
