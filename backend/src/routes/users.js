// backend/src/routes/users.js
import { Router } from "express";
import { requireAuth } from "./auth.js"; // 👈 import trực tiếp từ auth.js
import "dotenv/config";

const useMySQL = (process.env.DB_DRIVER || "sqlite") === "mysql";
let db;
if (useMySQL) { ({ db } = await import("../lib/db.mysql.js")); }
else          { ({ db } = await import("../lib/db.js")); }

const router = Router();

/* =========================
   DB helpers (driver-agnostic)
========================= */
async function get(sql, params = []) {
  if (useMySQL) {
    if (typeof db.get === "function") return await db.get(sql, params);
    if (typeof db.query === "function") { const [rows] = await db.query(sql, params); return rows?.[0] ?? null; }
    throw new Error("MySQL adapter missing .get/.query");
  }
  return db.prepare(sql).get(...params);
}
async function all(sql, params = []) {
  if (useMySQL) {
    if (typeof db.all === "function") return await db.all(sql, params);
    if (typeof db.query === "function") { const [rows] = await db.query(sql, params); return rows; }
    throw new Error("MySQL adapter missing .all/.query");
  }
  return db.prepare(sql).all(...params);
}
async function run(sql, params = []) {
  if (useMySQL) {
    if (typeof db.run === "function") return await db.run(sql, params);
    if (typeof db.query === "function") { const [ret] = await db.query(sql, params); return ret; }
    throw new Error("MySQL adapter missing .run/.query");
  }
  return db.prepare(sql).run(...params);
}

/* =========================
   1) Profile
========================= */

// GET /api/users/me – luôn trả FULL user, không trả null
router.get("/me", requireAuth, async (req, res) => {
  const uid = req.user?.id; // JWT có cả id & uid, dùng id
  if (!uid) return res.status(401).json({ message: "Unauthenticated" });

  const row = await get(
    "SELECT id,email,name,avatar_url,role,address,phone,status,lat,lng FROM users WHERE id=?",
    [uid]
  );
  if (!row) return res.status(404).json({ message: "User not found" });
  res.json(row);
});

// PATCH /api/users/me – cập nhật & trả FULL user
router.patch("/me", requireAuth, async (req, res) => {
  const uid = req.user?.id;
  if (!uid) return res.status(401).json({ message: "Unauthenticated" });

  const { name = "", address = "", avatar_url = "", phone = "", lat = null, lng = null } = req.body || {};

  await run(
    "UPDATE users SET name=?, address=?, avatar_url=?, phone=?, lat=?, lng=? WHERE id=?",
    [name, address, avatar_url, phone, lat, lng, uid]
  );

  const row = await get(
    "SELECT id,email,name,avatar_url,role,address,phone,status,lat,lng FROM users WHERE id=?",
    [uid]
  );
  if (!row) return res.status(404).json({ message: "User not found after update" });

  res.json(row);
});

/* =========================
   2) History
========================= */

// GET /api/users/history?limit=8
router.get("/history", requireAuth, async (req, res) => {
  const uid = req.user.id;
  const limit = Math.min(Number(req.query.limit || 8), 50);

  const given = await all(
    "SELECT id, title AS name, created_at FROM food_items WHERE owner_id=? ORDER BY created_at DESC LIMIT ?",
    [uid, limit]
  );

  const received = await all(
    `SELECT b.id, COALESCE(fi.title,'Bundle') AS name, b.created_at
       FROM bookings b
       LEFT JOIN food_items fi ON fi.id = b.item_id
      WHERE b.receiver_id=?
      ORDER BY b.created_at DESC
      LIMIT ?`,
    [uid, limit]
  );

  const payments = await all(
    "SELECT id, amount, status, created_at FROM payments WHERE payer_id=? ORDER BY created_at DESC LIMIT ?",
    [uid, limit]
  );

  res.json({ given, received, payments });
});

/* =========================
   3) Export & Delete
========================= */

// GET /api/users/export
router.get("/export", requireAuth, async (req, res) => {
  const uid = req.user.id;

  const user           = await get("SELECT * FROM users WHERE id=?", [uid]);
  const items          = await all("SELECT * FROM food_items WHERE owner_id=?", [uid]);
  const bookings       = await all("SELECT * FROM bookings WHERE receiver_id=?", [uid]);
  const payments       = await all("SELECT * FROM payments WHERE payer_id=?", [uid]);
  const notifications  = await all("SELECT * FROM notifications WHERE user_id=?", [uid]);
  const reports        = await all("SELECT * FROM reports WHERE reporter_id=?", [uid]);

  const payload = {
    exported_at: new Date().toISOString(),
    user, items, bookings, payments, notifications, reports,
  };

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="bua-com-xanh-${uid}.json"`);
  res.status(200).send(JSON.stringify(payload, null, 2));
});

// POST /api/users/delete
router.post("/delete", requireAuth, async (req, res) => {
  const uid = req.user.id;
  await run("UPDATE users SET status='deleted' WHERE id=?", [uid]);
  await run("UPDATE food_items SET status='hidden' WHERE owner_id=?", [uid]);
  res.json({ ok: true });
});

/* =========================
   4) Sessions (mock cho UI)
========================= */

// GET /api/users/sessions
router.get("/sessions", requireAuth, async (req, res) => {
  const list = [
    {
      id: "current",
      device: "This device",
      ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress || "",
      last_seen: new Date().toISOString(),
      current: true,
    },
  ];
  res.json(list);
});

// POST /api/users/logout-others
router.post("/logout-others", requireAuth, async (_req, res) => {
  res.json({ ok: true });
});

export default router;
