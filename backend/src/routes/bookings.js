// ESM
import { Router } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import "dotenv/config";

const useMySQL = (process.env.DB_DRIVER || "mysql") === "mysql";
let db;
if (useMySQL) ({ db } = await import("../lib/db.mysql.js"));
else ({ db } = await import("../lib/db.js"));

export const bookingsRouter = Router();

/* ================ helpers ================ */
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const ROLES = { ADMIN: "admin", SHIPPER: "shipper", RECEIVER: "receiver", USER: "user", DONOR: "donor" };

const i = (v, d = 0) => (Number.isFinite(+v) ? Math.trunc(+v) : d);
const nowExpr = () => (useMySQL ? "NOW()" : "CURRENT_TIMESTAMP");

// driver-agnostic db helpers
async function dbGet(sql, params = []) {
  if (typeof db.get === "function") return await db.get(sql, params);
  const [rows] = await db.query(sql, params);
  return rows?.[0] ?? null;
}
async function dbAll(sql, params = []) {
  if (typeof db.all === "function") return await db.all(sql, params);
  const [rows] = await db.query(sql, params);
  return rows ?? [];
}
async function dbRun(sql, params = []) {
  if (useMySQL) {
    const [res] = await db.query(sql, params);
    return { changes: res?.affectedRows ?? 0 };
  }
  const stmt = db.prepare(sql);
  const info = stmt.run(...params);
  return { changes: info.changes };
}

function auth(req, res, next) {
  try {
    const h = req.headers.authorization || "";
    const token = h.startsWith("Bearer ") ? h.slice(7) : "";
    if (!token) return res.status(401).json({ error: "unauthorized" });
    req.user = jwt.verify(token, JWT_SECRET); // { id, role, ...}
    next();
  } catch {
    res.status(401).json({ error: "unauthorized" });
  }
}
const isAdmin = (u) => u?.role === ROLES.ADMIN;

// enums khớp schema dump
const BOOKING_STATUS = new Set(["pending", "accepted", "rejected", "cancelled", "completed", "expired"]);
const METHODS = new Set(["pickup", "meet", "delivery"]);

/* ================ GET /api/bookings ================ */
/* Query: page, pageSize, status?, q?
   - admin: thấy tất cả
   - user/receiver: chỉ thấy của mình
*/
bookingsRouter.get("/bookings", auth, async (req, res) => {
  try {
    const page = Math.max(1, i(req.query.page, 1));
    const pageSize = Math.min(100, Math.max(1, i(req.query.pageSize, 50)));
    const off = (page - 1) * pageSize;
    const status = String(req.query.status || "").trim();
    const q = String(req.query.q || "").trim();

    const where = [];
    const params = [];

    if (!isAdmin(req.user)) { where.push("receiver_id = ?"); params.push(req.user.id); }
    if (status) {
      if (!BOOKING_STATUS.has(status)) return res.status(400).json({ error: "invalid_status" });
      where.push("status = ?"); params.push(status);
    }
    if (q) { where.push("(note LIKE ?)"); params.push(`%${q}%`); }

    const W = where.length ? "WHERE " + where.join(" AND ") : "";

    const rows = await dbAll(
      `
      SELECT id, item_id, bundle_id, receiver_id, qty, note, method, pickup_point, status, created_at, updated_at
      FROM bookings
      ${W}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?`,
      [...params, pageSize, off]
    );
    const totalRow = await dbGet(`SELECT COUNT(*) AS total FROM bookings ${W}`, params);

    res.json({ items: rows, page, pageSize, total: totalRow?.total ?? 0 });
  } catch (e) {
    res.status(500).json({ error: e.message || "server_error" });
  }
});

/* ================ GET /api/receiver/bookings ================ */
bookingsRouter.get("/receiver/bookings", auth, async (req, res) => {
  try {
    const page = Math.max(1, i(req.query.page, 1));
    const pageSize = Math.min(100, Math.max(1, i(req.query.pageSize, 50)));
    const off = (page - 1) * pageSize;
    const status = String(req.query.status || "").trim();
    const q = String(req.query.q || "").trim();

    const where = ["receiver_id = ?"];
    const params = [req.user.id];

    if (status) {
      if (!BOOKING_STATUS.has(status)) return res.status(400).json({ error: "invalid_status" });
      where.push("status = ?"); params.push(status);
    }
    if (q) { where.push("(note LIKE ?)"); params.push(`%${q}%`); }

    const W = "WHERE " + where.join(" AND ");

    const rows = await dbAll(
      `
      SELECT id, item_id, bundle_id, receiver_id, qty, note, method, pickup_point, status, created_at, updated_at
      FROM bookings
      ${W}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?`,
      [...params, pageSize, off]
    );
    const totalRow = await dbGet(`SELECT COUNT(*) AS total FROM bookings ${W}`, params);

    res.json({ items: rows, page, pageSize, total: totalRow?.total ?? 0 });
  } catch (e) {
    res.status(500).json({ error: e.message || "server_error" });
  }
});

/* ================ POST /api/bookings ================ */
// Body: { qty, method('pickup'|'meet'|'delivery'), pickup_point?, note?, item_id?, bundle_id? }
bookingsRouter.post("/bookings", auth, async (req, res) => {
  try {
    const id = crypto.randomUUID();
    const qty = Math.max(1, i(req.body?.qty, 1));
    const method = METHODS.has(String(req.body?.method)) ? String(req.body.method) : "pickup";
    const pickup_point = method === "pickup" ? (req.body?.pickup_point || null) : null;

    const payload = {
      id,
      item_id: req.body?.item_id || null,
      bundle_id: req.body?.bundle_id || null,
      receiver_id: req.user.id,
      qty,
      note: req.body?.note || null,
      method,
      pickup_point,
      status: "pending",
    };

    await dbRun(
      `INSERT INTO bookings (id, item_id, bundle_id, receiver_id, qty, note, method, pickup_point, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ${nowExpr()})`,
      [payload.id, payload.item_id, payload.bundle_id, payload.receiver_id, payload.qty, payload.note, payload.method, payload.pickup_point, payload.status]
    );

    const row = await dbGet(`SELECT * FROM bookings WHERE id=?`, [id]);
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: e.message || "server_error" });
  }
});

/* ================ PATCH /api/bookings/:id ================ */
// Body (subset): { status?, note?, qty?, method?, pickup_point? } — người nhận chỉ được hủy khi pending
bookingsRouter.patch("/bookings/:id", auth, async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    const b = await dbGet(`SELECT * FROM bookings WHERE id=?`, [id]);
    if (!b) return res.status(404).json({ error: "not_found" });

    // quyền: admin thì thoải mái; receiver chỉ sửa nếu là của mình
    if (!isAdmin(req.user) && b.receiver_id !== req.user.id) {
      return res.status(403).json({ error: "forbidden" });
    }

    const set = [];
    const params = [];

    if (req.body.status !== undefined) {
      const s = String(req.body.status).trim();
      if (!BOOKING_STATUS.has(s)) return res.status(400).json({ error: "invalid_status" });
      // receiver chỉ được cancel khi pending
      if (!isAdmin(req.user)) {
        if (!(b.status === "pending" && s === "cancelled")) {
          return res.status(403).json({ error: "not_allowed" });
        }
      }
      set.push("status=?"); params.push(s);
    }

    if (req.body.note !== undefined) { set.push("note=?"); params.push(String(req.body.note)); }
    if (req.body.qty !== undefined) { set.push("qty=?"); params.push(Math.max(1, i(req.body.qty, 1))); }

    if (req.body.method !== undefined) {
      const m = String(req.body.method);
      if (!METHODS.has(m)) return res.status(400).json({ error: "invalid_method" });
      set.push("method=?"); params.push(m);
      if (m === "pickup") {
        set.push("pickup_point=?"); params.push(req.body.pickup_point || null);
      } else {
        set.push("pickup_point=?"); params.push(null);
      }
    } else if (req.body.pickup_point !== undefined) {
      // chỉ hợp lệ khi method hiện tại là pickup
      if (b.method !== "pickup") return res.status(400).json({ error: "pickup_point_only_for_pickup" });
      set.push("pickup_point=?"); params.push(req.body.pickup_point || null);
    }

    if (!set.length) return res.status(400).json({ error: "no_updatable_fields" });

    set.push(`updated_at=${nowExpr()}`);
    await dbRun(`UPDATE bookings SET ${set.join(", ")} WHERE id=?`, [...params, id]);

    const row = await dbGet(`SELECT * FROM bookings WHERE id=?`, [id]);
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: e.message || "server_error" });
  }
});

/* ================ POST /api/bookings/:id/cancel ================ */
bookingsRouter.post("/bookings/:id/cancel", auth, async (req, res) => {
  try {
    const id = String(req.params.id || "");
    const b = await dbGet(`SELECT * FROM bookings WHERE id=?`, [id]);
    if (!b) return res.status(404).json({ error: "not_found" });

    if (!isAdmin(req.user) && b.receiver_id !== req.user.id) {
      return res.status(403).json({ error: "forbidden" });
    }
    if (b.status !== "pending") return res.status(409).json({ error: "cannot_cancel" });

    await dbRun(`UPDATE bookings SET status='cancelled', updated_at=${nowExpr()} WHERE id=?`, [id]);
    const row = await dbGet(`SELECT * FROM bookings WHERE id=?`, [id]);
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: e.message || "server_error" });
  }
});
