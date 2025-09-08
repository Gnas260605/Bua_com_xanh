// backend/src/routes/admin.js
import { Router } from "express";
import jwt from "jsonwebtoken";
import { requireAuth } from "./auth.js";
import { requireRole } from "../middlewares/roles.js";
import "dotenv/config";

/* =========================
   DB bootstrap (MySQL | SQLite)
========================= */
const useMySQL = (process.env.DB_DRIVER || "sqlite") === "mysql";
let db;
if (useMySQL) { ({ db } = await import("../lib/db.mysql.js")); }
else          { ({ db } = await import("../lib/db.js")); }

/* =========================
   DB helpers (driver-agnostic)
========================= */
async function get(sql, params = []) {
  if (useMySQL) {
    if (typeof db.get === "function") return await db.get(sql, params);
    if (typeof db.all === "function") { const rows = await db.all(sql, params); return rows?.[0] ?? null; }
  } else {
    return db.prepare(sql).get(...params);
  }
  throw new Error("adapter missing get/all");
}
async function all(sql, params = []) {
  if (useMySQL) {
    if (typeof db.all === "function") return await db.all(sql, params);
  } else {
    return db.prepare(sql).all(...params);
  }
  throw new Error("adapter missing all");
}
async function run(sql, params = []) {
  if (useMySQL) {
    if (typeof db.run === "function") return await db.run(sql, params);
  } else {
    return db.prepare(sql).run(...params);
  }
  throw new Error("adapter missing run");
}

const nowExpr = useMySQL ? "NOW()" : "datetime('now')";
const likeWrap = (s) => "%" + s + "%";

/* =========================
   Ensure schemas (idempotent)
========================= */

// MySQL helpers (đều đi qua all())
async function hasColumn(table, column) {
  if (!useMySQL) return true;
  const rows = await all(
    `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?
     LIMIT 1`,
    [table, column]
  ).catch(() => []);
  return rows.length > 0;
}
async function getColumnType(table, column) {
  if (!useMySQL) return null;
  const rows = await all(
    `SELECT DATA_TYPE, COLUMN_TYPE
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
      LIMIT 1`,
    [table, column]
  ).catch(() => []);
  return rows?.[0] ?? null;
}

let auditPkMode = "auto_inc"; // "auto_inc" | "uuid"

async function ensureSchemas() {
  if (useMySQL) {
    // Các bảng phụ bền vững
    await run(`CREATE TABLE IF NOT EXISTS reports (
      id INT AUTO_INCREMENT PRIMARY KEY,
      reporter_id VARCHAR(64), target_user_id VARCHAR(64), target_item_id VARCHAR(64),
      reason TEXT, status VARCHAR(24) NOT NULL DEFAULT 'open',
      notes TEXT, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      resolved_at DATETIME NULL,
      INDEX idx_status (status)
    )`).catch(()=>{});

    await run(`CREATE TABLE IF NOT EXISTS site_settings (
      k VARCHAR(128) PRIMARY KEY,
      v TEXT,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`).catch(()=>{});

    await run(`CREATE TABLE IF NOT EXISTS announcements (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      level VARCHAR(16) NOT NULL DEFAULT 'info',
      active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NULL
    )`).catch(()=>{});

    // audit_logs có thể là schema cũ (UUID PK) hoặc mới (INT AI)
    await run(`CREATE TABLE IF NOT EXISTS audit_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      actor_id VARCHAR(64), action VARCHAR(64), target_id VARCHAR(64),
      detail TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_action (action), INDEX idx_actor (actor_id)
    )`).catch(()=>{ /* nếu đã tồn tại dạng UUID thì bỏ qua */ });

    // nhận diện kiểu id
    try {
      const t = await getColumnType("audit_logs", "id");
      const colType = (t?.COLUMN_TYPE || t?.DATA_TYPE || "").toLowerCase();
      if (colType.includes("char(36)") || colType.includes("uuid")) {
        auditPkMode = "uuid";
      } else if (colType.includes("int")) {
        auditPkMode = "auto_inc";
      }
    } catch {
      auditPkMode = "auto_inc";
    }

    // Bổ sung các cột còn thiếu (idempotent)
    const cols = ["actor_id","action","target_id","detail","created_at"];
    for (const c of cols) {
      if (!(await hasColumn("audit_logs", c))) {
        let ddl = "VARCHAR(64)";
        if (c === "detail") ddl = "TEXT";
        if (c === "created_at") ddl = "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP";
        await run(`ALTER TABLE audit_logs ADD COLUMN ${c} ${ddl}`).catch(()=>{});
      }
    }
    // Index (an toàn nếu đã tồn tại)
    await run(`CREATE INDEX IF NOT EXISTS idx_action ON audit_logs(action)`).catch(()=>{});
    await run(`CREATE INDEX IF NOT EXISTS idx_actor  ON audit_logs(actor_id)`).catch(()=>{});
  } else {
    // SQLite
    await run(`CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_id TEXT, action TEXT, target_id TEXT,
      detail TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`).catch(()=>{});

    await run(`CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reporter_id TEXT, target_user_id TEXT, target_item_id TEXT,
      reason TEXT, status TEXT NOT NULL DEFAULT 'open',
      notes TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')),
      resolved_at TEXT
    )`).catch(()=>{});

    await run(`CREATE TABLE IF NOT EXISTS site_settings (
      k TEXT PRIMARY KEY, v TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`).catch(()=>{});

    await run(`CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL, content TEXT NOT NULL,
      level TEXT NOT NULL DEFAULT 'info',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT
    )`).catch(()=>{});
  }
}
await ensureSchemas();

/* =========================
   Audit logger (never crashes)
========================= */
async function logAudit(actorId, action, targetId, detail) {
  const payload = typeof detail === "string" ? detail : JSON.stringify(detail ?? {});
  try {
    if (useMySQL) {
      if (auditPkMode === "uuid") {
        // bảng cũ: id CHAR(36) PK
        await run(
          "INSERT INTO audit_logs (id, actor_id, action, target_id, detail) VALUES (UUID(), ?, ?, ?, ?)",
          [actorId ?? null, action ?? null, targetId ?? null, payload]
        );
      } else {
        // bảng chuẩn: id INT AUTO_INCREMENT PK
        await run(
          "INSERT INTO audit_logs (actor_id, action, target_id, detail) VALUES (?,?,?,?)",
          [actorId ?? null, action ?? null, targetId ?? null, payload]
        );
      }
    } else {
      await run(
        "INSERT INTO audit_logs (actor_id, action, target_id, detail) VALUES (?,?,?,?)",
        [actorId ?? null, action ?? null, targetId ?? null, payload]
      );
    }
  } catch (e) {
    console.warn("[audit] skipped:", e.code || e.message);
  }
}

/* =========================
   Router & endpoints
========================= */
const admin = Router();

/* ---- 0) Admin stats ---- */
admin.get("/stats", requireAuth, requireRole("admin"), async (_req, res) => {
  const usersTotal   = await get("SELECT COUNT(*) AS c FROM users", []).catch(()=>({ c: 0 }));
  const usersByRole  = await all("SELECT role, COUNT(*) AS c FROM users GROUP BY role", []).catch(()=>[]);
  const itemsByStatus= await all("SELECT status, COUNT(*) AS c FROM food_items GROUP BY status", []).catch(()=>[]);
  const campaignsTot = await get("SELECT COUNT(*) AS c FROM campaigns", []).catch(()=>({ c: 0 }));
  const paymentsAgg  = await all("SELECT status, COUNT(*) AS c, SUM(amount) AS sum_amount FROM payments GROUP BY status", []).catch(()=>[]);

  res.json({
    users:     { total: Number(usersTotal?.c ?? 0), byRole: usersByRole },
    foods:     { byStatus: itemsByStatus },
    campaigns: { total: Number(campaignsTot?.c ?? 0) },
    payments:  paymentsAgg
  });
});

/* ---- 1) Users management ---- */
admin.get("/users", requireAuth, requireRole("admin"), async (req, res) => {
  const q        = String(req.query.q || "").trim();
  const role     = String(req.query.role || "").trim();
  const status   = String(req.query.status || "").trim();
  const page     = Math.max(1, Number(req.query.page || 1));
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize || 20)));
  const offset   = (page - 1) * pageSize;

  const where = [], params = [];
  if (q)      { where.push("(email LIKE ? OR name LIKE ?)"); params.push(likeWrap(q), likeWrap(q)); }
  if (role)   { where.push("role=?");   params.push(role); }
  if (status) { where.push("status=?"); params.push(status); }
  const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";

  const items = await all(
    "SELECT id,email,name,avatar_url,role,address,phone,status,created_at FROM users " +
    whereSql + " ORDER BY created_at DESC LIMIT ? OFFSET ?",
    [...params, pageSize, offset]
  ).catch(()=>[]);
  const cnt = await get("SELECT COUNT(*) AS total FROM users " + whereSql, params).catch(()=>({ total: 0 }));
  res.json({ items, total: Number(cnt?.total ?? 0), page, pageSize });
});

admin.patch("/users/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const uid = req.params.id;
  const { name, role, status } = req.body || {};
  const set = [], params = [];
  if (name   !== undefined) { set.push("name=?");   params.push(String(name)); }
  if (role   !== undefined) { set.push("role=?");   params.push(String(role)); }
  if (status !== undefined) { set.push("status=?"); params.push(String(status)); }
  if (!set.length) return res.json({ ok: true });
  params.push(uid);

  await run("UPDATE users SET " + set.join(", ") + " WHERE id=?", params).catch(()=>{});
  await logAudit(req.user?.id, "admin.update_user", uid, { name, role, status });

  const row = await get(
    "SELECT id,email,name,avatar_url,role,address,phone,status,created_at FROM users WHERE id=?",
    [uid]
  ).catch(()=>null);
  res.json(row ?? { ok: true });
});

admin.post("/users/:id/lock",   requireAuth, requireRole("admin"), async (req, res) => {
  await run("UPDATE users SET status='locked' WHERE id=?", [req.params.id]).catch(()=>{});
  await logAudit(req.user?.id, "admin.lock_user", req.params.id, {});
  res.json({ ok: true });
});
admin.post("/users/:id/unlock", requireAuth, requireRole("admin"), async (req, res) => {
  await run("UPDATE users SET status='active' WHERE id=?", [req.params.id]).catch(()=>{});
  await logAudit(req.user?.id, "admin.unlock_user", req.params.id, {});
  res.json({ ok: true });
});
admin.delete("/users/:id",      requireAuth, requireRole("admin"), async (req, res) => {
  await run("UPDATE users SET status='deleted' WHERE id=?", [req.params.id]).catch(()=>{});
  await logAudit(req.user?.id, "admin.delete_user", req.params.id, {});
  res.json({ ok: true });
});

/* ---- 2) Foods moderation ---- */
admin.get("/foods", requireAuth, requireRole("admin"), async (req, res) => {
  const status   = String(req.query.status || "").trim();
  const owner    = String(req.query.owner || "").trim();
  const q        = String(req.query.q || "").trim();
  const page     = Math.max(1, Number(req.query.page || 1));
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize || 20)));
  const offset   = (page - 1) * pageSize;

  const where = [], params = [];
  if (status) { where.push("status=?"); params.push(status); }
  if (owner)  { where.push("owner_id=?"); params.push(owner); }
  if (q)      { where.push("(title LIKE ? OR description LIKE ?)"); params.push(likeWrap(q), likeWrap(q)); }
  const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";

  const items = await all(
    "SELECT id,title,owner_id,status,quantity,expires_at,created_at FROM food_items " +
    whereSql + " ORDER BY created_at DESC LIMIT ? OFFSET ?",
    [...params, pageSize, offset]
  ).catch(()=>[]);
  const cnt = await get("SELECT COUNT(*) AS total FROM food_items " + whereSql, params).catch(()=>({ total: 0 }));
  res.json({ items, total: Number(cnt?.total ?? 0), page, pageSize });
});

admin.patch("/foods/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const id = req.params.id;
  const { status, title, description, quantity, expires_at } = req.body || {};
  const set = [], params = [];
  if (status      !== undefined) { set.push("status=?");      params.push(String(status)); }
  if (title       !== undefined) { set.push("title=?");       params.push(String(title)); }
  if (description !== undefined) { set.push("description=?"); params.push(String(description)); }
  if (quantity    !== undefined) { set.push("quantity=?");    params.push(Number(quantity)); }
  if (expires_at  !== undefined) { set.push("expires_at=?");  params.push(String(expires_at)); }
  if (!set.length) return res.json({ ok: true });
  params.push(id);

  await run("UPDATE food_items SET " + set.join(", ") + " WHERE id=?", params).catch(()=>{});
  await logAudit(req.user?.id, "admin.update_food", id, { status, title });

  const row = await get(
    "SELECT id,title,status,owner_id,quantity,expires_at FROM food_items WHERE id=?",
    [id]
  ).catch(()=>null);
  res.json(row ?? { ok: true });
});

admin.delete("/foods/:id", requireAuth, requireRole("admin"), async (req, res) => {
  await run("UPDATE food_items SET status='hidden' WHERE id=?", [req.params.id]).catch(()=>{});
  await logAudit(req.user?.id, "admin.hide_food", req.params.id, {});
  res.json({ ok: true });
});

/* ---- 3) Campaigns CRUD ---- */
admin.get("/campaigns", requireAuth, requireRole("admin"), async (req, res) => {
  const q        = String(req.query.q || "").trim();
  const status   = String(req.query.status || "").trim();
  const page     = Math.max(1, Number(req.query.page || 1));
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize || 20)));
  const offset   = (page - 1) * pageSize;

  const where = [], params = [];
  if (q)      { where.push("(title LIKE ? OR description LIKE ?)"); params.push(likeWrap(q), likeWrap(q)); }
  if (status) { where.push("status=?"); params.push(status); }
  const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";

  const items = await all(
    "SELECT id,title,cover_url,status,target_amount,raised_amount,start_at,end_at,created_at FROM campaigns " +
    whereSql + " ORDER BY created_at DESC LIMIT ? OFFSET ?",
    [...params, pageSize, offset]
  ).catch(()=>[]);
  const cnt = await get("SELECT COUNT(*) AS total FROM campaigns " + whereSql, params).catch(()=>({ total: 0 }));
  res.json({ items, total: Number(cnt?.total ?? 0), page, pageSize });
});

admin.post("/campaigns", requireAuth, requireRole("admin"), async (req, res) => {
  const { title, description, cover_url, target_amount, start_at, end_at, status } = req.body || {};
  if (!title) return res.status(400).json({ message: "Thiếu title" });

  await run(
    "INSERT INTO campaigns (title, description, cover_url, target_amount, raised_amount, start_at, end_at, status, created_at) " +
    `VALUES (?,?,?,?,0,?,?,?, ${nowExpr})`,
    [String(title), String(description || ""), String(cover_url || ""), Number(target_amount || 0), start_at || null, end_at || null, String(status || "draft")]
  ).catch(()=>{});
  await logAudit(req.user?.id, "admin.create_campaign", null, { title });
  res.json({ ok: true });
});

admin.patch("/campaigns/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const id = req.params.id;
  const { title, description, cover_url, status, target_amount, raised_amount, start_at, end_at } = req.body || {};
  const set = [], params = [];
  if (title         !== undefined) { set.push("title=?");         params.push(String(title)); }
  if (description   !== undefined) { set.push("description=?");   params.push(String(description)); }
  if (cover_url     !== undefined) { set.push("cover_url=?");     params.push(String(cover_url)); }
  if (status        !== undefined) { set.push("status=?");        params.push(String(status)); }
  if (target_amount !== undefined) { set.push("target_amount=?"); params.push(Number(target_amount)); }
  if (raised_amount !== undefined) { set.push("raised_amount=?"); params.push(Number(raised_amount)); }
  if (start_at      !== undefined) { set.push("start_at=?");      params.push(start_at || null); }
  if (end_at        !== undefined) { set.push("end_at=?");        params.push(end_at || null); }
  if (!set.length) return res.json({ ok: true });
  params.push(id);

  await run("UPDATE campaigns SET " + set.join(", ") + " WHERE id=?", params).catch(()=>{});
  await logAudit(req.user?.id, "admin.update_campaign", id, { title, status });
  res.json({ ok: true });
});

admin.delete("/campaigns/:id", requireAuth, requireRole("admin"), async (req, res) => {
  await run("UPDATE campaigns SET status='archived' WHERE id=?", [req.params.id]).catch(()=>{});
  await logAudit(req.user?.id, "admin.archive_campaign", req.params.id, {});
  res.json({ ok: true });
});

/* ---- 4) Payments ---- */
admin.get("/payments", requireAuth, requireRole("admin"), async (req, res) => {
  const status   = String(req.query.status || "").trim();
  const payer    = String(req.query.payer || "").trim();
  const page     = Math.max(1, Number(req.query.page || 1));
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize || 20)));
  const offset   = (page - 1) * pageSize;

  const where = [], params = [];
  if (status) { where.push("status=?"); params.push(status); }
  if (payer)  { where.push("payer_id=?"); params.push(payer); }
  const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";

  const items = await all(
    "SELECT id,payer_id,amount,status,created_at FROM payments " +
    whereSql + " ORDER BY created_at DESC LIMIT ? OFFSET ?",
    [...params, pageSize, offset]
  ).catch(()=>[]);
  const cnt = await get("SELECT COUNT(*) AS total FROM payments " + whereSql, params).catch(()=>({ total: 0 }));
  res.json({ items, total: Number(cnt?.total ?? 0), page, pageSize });
});

admin.patch("/payments/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const { status } = req.body || {};
  if (!status) return res.status(400).json({ message: "Thiếu status" });

  await run(
    `UPDATE payments SET status=?, updated_at=${nowExpr} WHERE id=?`,
    [String(status), req.params.id]
  ).catch(()=>{});
  await logAudit(req.user?.id, "admin.update_payment", req.params.id, { status });
  res.json({ ok: true });
});

/* ---- 5) Site settings ---- */
admin.get("/settings", requireAuth, requireRole("admin"), async (_req, res) => {
  const rows = await all("SELECT k, v FROM site_settings", []).catch(()=>[]);
  const data = {};
  for (const r of rows) data[r.k] = r.v;
  res.json(data);
});

admin.put("/settings", requireAuth, requireRole("admin"), async (req, res) => {
  const body = req.body || {};
  const entries = Object.entries(body);

  for (const [k, v] of entries) {
    const val = typeof v === "string" ? v : JSON.stringify(v);
    if (useMySQL) {
      await run(
        `INSERT INTO site_settings (k, v, updated_at)
           VALUES (?, ?, ${nowExpr})
         ON DUPLICATE KEY UPDATE v=VALUES(v), updated_at=${nowExpr}`,
        [String(k), val]
      ).catch(()=>{});
    } else {
      const exists = await get("SELECT k FROM site_settings WHERE k=?", [String(k)]).catch(()=>null);
      if (exists) await run(`UPDATE site_settings SET v=?, updated_at=${nowExpr} WHERE k=?`, [val, String(k)]).catch(()=>{});
      else        await run(`INSERT INTO site_settings (k, v, updated_at) VALUES (?, ?, ${nowExpr})`, [String(k), val]).catch(()=>{});
    }
  }
  await logAudit(req.user?.id, "admin.update_settings", null, { keys: entries.map(([k]) => k) });
  res.json({ ok: true });
});

/* ---- 6) Announcements ---- */
admin.get("/announcements", requireAuth, requireRole("admin"), async (_req, res) => {
  const rows = await all(
    "SELECT id,title,content,level,active,created_at,updated_at FROM announcements ORDER BY id DESC",
    []
  ).catch(()=>[]);
  res.json(rows);
});

admin.post("/announcements", requireAuth, requireRole("admin"), async (req, res) => {
  const { title, content, level, active } = req.body || {};
  if (!title || !content) return res.status(400).json({ message: "Thiếu title/content" });

  await run(
    `INSERT INTO announcements (title, content, level, active, created_at)
     VALUES (?,?,?,?, ${nowExpr})`,
    [String(title), String(content), String(level || "info"), Number(active ?? 1)]
  ).catch(()=>{});
  await logAudit(req.user?.id, "admin.create_announcement", null, { title });
  res.json({ ok: true });
});

admin.patch("/announcements/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const { title, content, level, active } = req.body || {};
  const set = [], params = [];
  if (title   !== undefined) { set.push("title=?");   params.push(String(title)); }
  if (content !== undefined) { set.push("content=?"); params.push(String(content)); }
  if (level   !== undefined) { set.push("level=?");   params.push(String(level)); }
  if (active  !== undefined) { set.push("active=?");  params.push(Number(active ? 1 : 0)); }
  if (!set.length) return res.json({ ok: true });
  set.push(`updated_at=${nowExpr}`);
  params.push(req.params.id);

  await run("UPDATE announcements SET " + set.join(", ") + " WHERE id=?", params).catch(()=>{});
  await logAudit(req.user?.id, "admin.update_announcement", req.params.id, { title, active });
  res.json({ ok: true });
});

admin.delete("/announcements/:id", requireAuth, requireRole("admin"), async (req, res) => {
  await run("DELETE FROM announcements WHERE id=?", [req.params.id]).catch(()=>{});
  await logAudit(req.user?.id, "admin.delete_announcement", req.params.id, {});
  res.json({ ok: true });
});

/* ---- 7) Impersonate ---- */
admin.post("/impersonate", requireAuth, requireRole("admin"), async (req, res) => {
  const userId = String(req.body?.user_id || "");
  if (!userId) return res.status(400).json({ message: "Thiếu user_id" });

  const user = await get("SELECT id,email,name,role FROM users WHERE id=?", [userId]).catch(()=>null);
  if (!user) return res.status(404).json({ message: "User not found" });

  const payload = {
    id: user.id,
    uid: user.id,
    email: user.email,
    role: user.role,
    imp_by: req.user?.id
  };
  const token = jwt.sign(payload, process.env.JWT_SECRET || "dev_secret", { expiresIn: "10m" });

  await logAudit(req.user?.id, "admin.impersonate", userId, { as: user.email });
  res.json({ token, user });
});

export default admin;
