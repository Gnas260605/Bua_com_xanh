// src/routes/shippers.js
import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import jwt from "jsonwebtoken";
import "dotenv/config";

const useMySQL = (process.env.DB_DRIVER || "sqlite") === "mysql";
let db;
if (useMySQL) {
  ({ db } = await import("../lib/db.mysql.js"));
} else {
  ({ db } = await import("../lib/db.js"));
}

export const shipperRouter = Router();

/* =========================
   Small DB helpers
========================= */
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

async function dbRun(sql, params = []) {
  if (useMySQL) {
    if (typeof db.run === "function") return await db.run(sql, params);
    if (typeof db.execute === "function") {
      const [res] = await db.execute(sql, params);
      return res;
    }
    if (typeof db.query === "function") {
      const [res] = await db.query(sql, params);
      return res;
    }
    throw new Error("MySQL adapter missing .run/.execute/.query");
  }
  return db.prepare(sql).run(...params);
}

/* =========================
   Auth & Role guard
========================= */
function authRequired(req, res, next) {
  try {
    if (req.user) return next();
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Missing token" });
    const payload = jwt.verify(token, process.env.JWT_SECRET || "dev-secret");
    req.user = payload; // { id, role, email, ... }
    next();
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
}

function ensureRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}

/* =========================
   Upload (ảnh proof)
========================= */
const proofsDir = path.join(process.cwd(), "uploads", "proofs");
fs.mkdirSync(proofsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, proofsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || ".jpg");
    cb(null, `proof_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const upload = multer({ storage });

/* =========================
   Helpers
========================= */
const ALLOWED = ["pending", "assigned", "picked_up", "delivering", "delivered", "canceled"];

function assertTransition(prev, next) {
  const allowedEdges = {
    pending: ["assigned", "canceled"],
    assigned: ["picked_up", "canceled"],
    picked_up: ["delivering", "canceled"],
    delivering: ["delivered", "canceled"],
    delivered: [],
    canceled: [],
  };
  if (!ALLOWED.includes(next) || !allowedEdges[prev]?.includes(next)) {
    const err = new Error(`Invalid transition ${prev} -> ${next}`);
    err.status = 400;
    throw err;
  }
}

function genOTP() {
  return (Math.floor(Math.random() * 900000) + 100000).toString();
}

/* =========================
   ADMIN endpoints
========================= */
shipperRouter.post(
  "/admin/orders",
  authRequired,
  ensureRole("admin"),
  async (req, res) => {
    const {
      title,
      donor_id,
      receiver_id,
      pickup_address,
      pickup_lat,
      pickup_lng,
      drop_address,
      drop_lat,
      drop_lng,
      area_code,
      otp_code,
      qr_payload,
    } = req.body;

    const otp = otp_code || genOTP();
    const qr = qr_payload || JSON.stringify({ otp });

    const sql = useMySQL
      ? `INSERT INTO orders 
           (title, donor_id, receiver_id, pickup_address, pickup_lat, pickup_lng, 
            drop_address, drop_lat, drop_lng, area_code, status, otp_code, qr_payload, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,NOW(),NOW())`
      : `INSERT INTO orders 
           (title, donor_id, receiver_id, pickup_address, pickup_lat, pickup_lng, 
            drop_address, drop_lat, drop_lng, area_code, status, otp_code, qr_payload, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`;

    const params = [
      title || null,
      donor_id,
      receiver_id,
      pickup_address,
      pickup_lat ?? null,
      pickup_lng ?? null,
      drop_address,
      drop_lat ?? null,
      drop_lng ?? null,
      area_code || null,
      "pending",
      otp,
      qr,
    ];

    const r = await dbRun(sql, params);
    const id = useMySQL ? r.insertId : r.lastInsertRowid;

    await dbRun(
      `INSERT INTO shipment_events (order_id, actor_id, event, meta_json) VALUES (?,?,?,?)`,
      [id, req.user.id, "status_changed", JSON.stringify({ to: "pending" })]
    );

    const order = await dbGet(`SELECT * FROM orders WHERE id = ?`, [id]);
    res.json(order);
  }
);

shipperRouter.post(
  "/admin/orders/:id/assign",
  authRequired,
  ensureRole("admin"),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { shipper_id } = req.body;
      const order = await dbGet(`SELECT * FROM orders WHERE id = ?`, [id]);
      if (!order) return res.status(404).json({ error: "Order not found" });
      assertTransition(order.status, "assigned");

      const sql = useMySQL
        ? `UPDATE orders SET assigned_shipper_id=?, status='assigned', updated_at=NOW() WHERE id=?`
        : `UPDATE orders SET assigned_shipper_id=?, status='assigned', updated_at=CURRENT_TIMESTAMP WHERE id=?`;
      await dbRun(sql, [shipper_id, id]);

      await dbRun(
        `INSERT INTO shipment_events (order_id, actor_id, event, meta_json) VALUES (?,?,?,?)`,
        [id, req.user.id, "status_changed", JSON.stringify({ to: "assigned", shipper_id })]
      );

      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  }
);

/* =========================
   SHIPPER endpoints
========================= */
shipperRouter.get(
  "/orders/available",
  authRequired,
  ensureRole("shipper"),
  async (req, res) => {
    const { area = "", limit = 50 } = req.query;
    const params = [];
    let sql = `SELECT * FROM orders WHERE status='pending' AND assigned_shipper_id IS NULL`;
    if (area) {
      sql += ` AND area_code = ?`;
      params.push(area);
    }
    sql += ` ORDER BY created_at DESC LIMIT ?`;
    params.push(Number(limit));
    const rows = await dbAll(sql, params);
    res.json(rows);
  }
);

shipperRouter.get(
  "/orders/mine",
  authRequired,
  ensureRole("shipper"),
  async (req, res) => {
    const { status = "" } = req.query;
    const params = [req.user.id];
    let sql = `SELECT * FROM orders WHERE assigned_shipper_id = ?`;
    if (status) {
      sql += ` AND status = ?`;
      params.push(status);
    }
    sql += ` ORDER BY updated_at DESC`;
    const rows = await dbAll(sql, params);
    res.json(rows);
  }
);

shipperRouter.post(
  "/orders/:id/accept",
  authRequired,
  ensureRole("shipper"),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const order = await dbGet(`SELECT * FROM orders WHERE id = ?`, [id]);
      if (!order) return res.status(404).json({ error: "Order not found" });
      if (order.assigned_shipper_id && order.assigned_shipper_id !== req.user.id) {
        return res.status(409).json({ error: "Order already assigned" });
      }
      assertTransition(order.status, "assigned");

      const sql = useMySQL
        ? `UPDATE orders SET assigned_shipper_id=?, status='assigned', updated_at=NOW() WHERE id=?`
        : `UPDATE orders SET assigned_shipper_id=?, status='assigned', updated_at=CURRENT_TIMESTAMP WHERE id=?`;
      await dbRun(sql, [req.user.id, id]);

      await dbRun(
        `INSERT INTO shipment_events (order_id, actor_id, event, meta_json) VALUES (?,?,?,?)`,
        [id, req.user.id, "accepted", JSON.stringify({ by: "shipper" })]
      );

      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  }
);

shipperRouter.post(
  "/orders/:id/telemetry",
  authRequired,
  ensureRole("shipper"),
  async (req, res) => {
    const { id } = req.params;
    const { lat, lng, speed, heading, eta } = req.body;
    const order = await dbGet(`SELECT id, assigned_shipper_id FROM orders WHERE id=?`, [id]);
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (order.assigned_shipper_id !== req.user.id)
      return res.status(403).json({ error: "Not your order" });

    await dbRun(
      `INSERT INTO shipment_events (order_id, actor_id, event, meta_json) VALUES (?,?,?,?)`,
      [id, req.user.id, "telemetry", JSON.stringify({ lat, lng, speed, heading, eta })]
    );
    res.json({ ok: true });
  }
);

shipperRouter.post(
  "/orders/:id/status",
  authRequired,
  ensureRole("shipper"),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const order = await dbGet(`SELECT * FROM orders WHERE id=?`, [id]);
      if (!order) return res.status(404).json({ error: "Order not found" });
      if (order.assigned_shipper_id !== req.user.id)
        return res.status(403).json({ error: "Not your order" });

      assertTransition(order.status, status);

      const sql = useMySQL
        ? `UPDATE orders SET status=?, updated_at=NOW() WHERE id=?`
        : `UPDATE orders SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`;
      await dbRun(sql, [status, id]);

      await dbRun(
        `INSERT INTO shipment_events (order_id, actor_id, event, meta_json) VALUES (?,?,?,?)`,
        [id, req.user.id, "status_changed", JSON.stringify({ from: order.status, to: status })]
      );

      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  }
);

shipperRouter.post(
  "/orders/:id/proof",
  authRequired,
  ensureRole("shipper"),
  upload.array("files", 6),
  async (req, res) => {
    const { id } = req.params;
    const order = await dbGet(`SELECT * FROM orders WHERE id=?`, [id]);
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (order.assigned_shipper_id !== req.user.id)
      return res.status(403).json({ error: "Not your order" });

    const files = req.files || [];
    const urls = [];

    for (const f of files) {
      const rel = `/uploads/proofs/${path.basename(f.path)}`.replace(/\\/g, "/");
      urls.push(rel);
      await dbRun(
        `INSERT INTO delivery_proofs (order_id, shipper_id, url, note) VALUES (?,?,?,?)`,
        [id, req.user.id, rel, req.body.note || null]
      );
    }

    await dbRun(
      `INSERT INTO shipment_events (order_id, actor_id, event, meta_json) VALUES (?,?,?,?)`,
      [id, req.user.id, "proof_uploaded", JSON.stringify({ urls })]
    );

    res.json({ ok: true, urls });
  }
);

shipperRouter.post(
  "/orders/:id/confirm-delivery",
  authRequired,
  ensureRole("shipper"),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { otp } = req.body;
      const order = await dbGet(`SELECT * FROM orders WHERE id=?`, [id]);
      if (!order) return res.status(404).json({ error: "Order not found" });
      if (order.assigned_shipper_id !== req.user.id)
        return res.status(403).json({ error: "Not your order" });

      if (order.otp_code !== String(otp))
        return res.status(400).json({ error: "Mã OTP không đúng" });

      assertTransition(order.status, "delivered");

      const sql = useMySQL
        ? `UPDATE orders SET status='delivered', updated_at=NOW() WHERE id=?`
        : `UPDATE orders SET status='delivered', updated_at=CURRENT_TIMESTAMP WHERE id=?`;
      await dbRun(sql, [id]);

      await dbRun(
        `INSERT INTO shipment_events (order_id, actor_id, event, meta_json) VALUES (?,?,?,?)`,
        [id, req.user.id, "delivered", JSON.stringify({ method: "otp" })]
      );

      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  }
);

shipperRouter.get(
  "/orders/:id",
  authRequired,
  ensureRole("shipper", "admin"),
  async (req, res) => {
    const { id } = req.params;
    const order = await dbGet(`SELECT * FROM orders WHERE id=?`, [id]);
    if (!order) return res.status(404).json({ error: "Order not found" });

    if (req.user.role === "shipper" && order.assigned_shipper_id !== req.user.id)
      return res.status(403).json({ error: "Not your order" });

    const events = await dbAll(
      `SELECT * FROM shipment_events WHERE order_id=? ORDER BY created_at ASC`,
      [id]
    );
    const proofs = await dbAll(
      `SELECT id, url, created_at FROM delivery_proofs WHERE order_id=? ORDER BY created_at ASC`,
      [id]
    );
    res.json({ order, events, proofs });
  }
);

/* =========================
   Error handler local
========================= */
shipperRouter.use((err, _req, res, _next) => {
  const code = err.status || 500;
  res.status(code).json({ error: err.message || "Internal error" });
});

export default shipperRouter; // ✅ thêm default export để khớp với server.js
