// backend/src/routes/admin.js
import { Router } from "express";
import jwt from "jsonwebtoken";
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
    if (typeof db.query === "function") { const [rows] = await db.query(sql, params); return rows?.[0] ?? null; }
  } else {
    return db.prepare(sql).get(...params);
  }
  throw new Error("adapter missing get/all/query");
}
async function all(sql, params = []) {
  if (useMySQL) {
    if (typeof db.all === "function") return await db.all(sql, params);
    if (typeof db.query === "function") { const [rows] = await db.query(sql, params); return rows ?? []; }
  } else {
    return db.prepare(sql).all(...params);
  }
  throw new Error("adapter missing all/query");
}
async function run(sql, params = []) {
  if (useMySQL) {
    if (typeof db.run === "function") return await db.run(sql, params);
    if (typeof db.query === "function") { await db.query(sql, params); return; }
  } else {
    return db.prepare(sql).run(...params);
  }
  throw new Error("adapter missing run/query");
}

// Try helpers
async function tryAll(variants) {
  for (const { sql, params = [] } of variants) {
    try { const rows = await all(sql, params); return rows; } catch { /* noop */ }
  }
  return [];
}
async function tryGet(variants) {
  for (const { sql, params = [] } of variants) {
    try { const row = await get(sql, params); if (row) return row; } catch { /* noop */ }
  }
  return null;
}
async function tryRun(variants) {
  for (const { sql, params = [] } of variants) {
    try { await run(sql, params); return true; } catch { /* noop */ }
  }
  return false;
}

const nowExpr = useMySQL ? "NOW()" : "datetime('now')";
const likeWrap = (s) => "%" + s + "%";

/* =========================
   Ensure schemas / columns (idempotent)
========================= */
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
  // ——— Core tables (đã có trong dự án) ———
  if (useMySQL) {
    await run(`CREATE TABLE IF NOT EXISTS reports (
      id INT AUTO_INCREMENT PRIMARY KEY,
      reporter_id VARCHAR(64), target_user_id VARCHAR(64), target_item_id VARCHAR(64),
      reason TEXT, status VARCHAR(24) NOT NULL DEFAULT 'open',
      notes TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
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

    await run(`CREATE TABLE IF NOT EXISTS audit_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      actor_id VARCHAR(64), action VARCHAR(64), target_id VARCHAR(64),
      detail TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_action (action), INDEX idx_actor (actor_id)
    )`).catch(()=>{});

    await run(`CREATE TABLE IF NOT EXISTS tasks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      parent_id INT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT NULL,
      type VARCHAR(24) NOT NULL DEFAULT 'TASK',
      status VARCHAR(24) NOT NULL DEFAULT 'New',
      priority VARCHAR(16) NOT NULL DEFAULT 'Normal',
      assignee_id VARCHAR(64) NULL,
      sort_order INT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NULL,
      INDEX idx_parent (parent_id),
      INDEX idx_status (status),
      INDEX idx_type (type),
      INDEX idx_assignee (assignee_id)
    )`).catch(()=>{});

    await run(`CREATE TABLE IF NOT EXISTS task_comments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      task_id INT NOT NULL,
      author_id VARCHAR(64),
      content TEXT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_task (task_id)
    )`).catch(()=>{});

    await run(`CREATE TABLE IF NOT EXISTS pickup_points (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      address VARCHAR(255),
      lat DOUBLE, lng DOUBLE,
      active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NULL
    )`).catch(()=>{});

    await run(`CREATE TABLE IF NOT EXISTS cms_pages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      slug VARCHAR(128) NOT NULL UNIQUE,
      title VARCHAR(255) NOT NULL,
      content MEDIUMTEXT NOT NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'draft',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NULL
    )`).catch(()=>{});

    await run(`CREATE TABLE IF NOT EXISTS user_roles (
      user_id VARCHAR(64) NOT NULL,
      role VARCHAR(32) NOT NULL,
      PRIMARY KEY (user_id, role)
    )`).catch(()=>{});
  } else {
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
    await run(`CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parent_id INTEGER,
      title TEXT NOT NULL,
      description TEXT,
      type TEXT NOT NULL DEFAULT 'TASK',
      status TEXT NOT NULL DEFAULT 'New',
      priority TEXT NOT NULL DEFAULT 'Normal',
      assignee_id TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT
    )`).catch(()=>{});
    await run(`CREATE TABLE IF NOT EXISTS task_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      author_id TEXT,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`).catch(()=>{});
    await run(`CREATE TABLE IF NOT EXISTS pickup_points (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT,
      lat REAL, lng REAL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT
    )`).catch(()=>{});
    await run(`CREATE TABLE IF NOT EXISTS cms_pages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT
    )`).catch(()=>{});
    await run(`CREATE TABLE IF NOT EXISTS user_roles (
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      PRIMARY KEY (user_id, role)
    )`).catch(()=>{});
  }

  // PK mode audit_logs
  try {
    const t = await getColumnType("audit_logs", "id");
    const colType = (t?.COLUMN_TYPE || t?.DATA_TYPE || "").toLowerCase();
    if (colType.includes("char(36)") || colType.includes("uuid")) auditPkMode = "uuid";
    else if (colType.includes("int")) auditPkMode = "auto_inc";
  } catch { auditPkMode = "auto_inc"; }

  // Ensure columns for audit_logs (MySQL)
  const cols = ["actor_id","action","target_id","detail","created_at"];
  for (const c of cols) {
    if (useMySQL && !(await hasColumn("audit_logs", c))) {
      let ddl = "VARCHAR(64)";
      if (c === "detail") ddl = "TEXT";
      if (c === "created_at") ddl = "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP";
      await run(`ALTER TABLE audit_logs ADD COLUMN ${c} ${ddl}`).catch(()=>{});
    }
  }

  // campaigns.deadline (optional)
  if (useMySQL) {
    try {
      if (!(await hasColumn("campaigns", "deadline"))) {
        await run(`ALTER TABLE campaigns ADD COLUMN deadline DATETIME NULL`).catch(()=>{});
        await run(`ALTER TABLE campaigns ADD INDEX idx_campaigns_deadline (deadline)`).catch(()=>{});
      }
    } catch {/* ignore if table doesn't exist */}
  } else {
    try { await run(`ALTER TABLE campaigns ADD COLUMN deadline TEXT`).catch(()=>{}); } catch {}
  }
}
await ensureSchemas();

/* =========================
   Audit logger
========================= */
async function logAudit(actorId, action, targetId, detail) {
  const payload = typeof detail === "string" ? detail : JSON.stringify(detail ?? {});
  try {
    if (useMySQL) {
      if (auditPkMode === "uuid") {
        await run(
          "INSERT INTO audit_logs (id, actor_id, action, target_id, detail) VALUES (UUID(), ?, ?, ?, ?)",
          [actorId ?? null, action ?? null, targetId ?? null, payload]
        );
      } else {
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
   Role helpers (sync users.role <-> user_roles)
========================= */
async function getUserRoles(userId) {
  const rows = await all("SELECT role FROM user_roles WHERE user_id=?", [userId]).catch(()=>[]);
  return rows.map(r => String(r.role));
}
async function addUserRole(userId, role) {
  if (!role) return;
  const params = [userId, role];
  if (useMySQL) {
    await run("INSERT IGNORE INTO user_roles (user_id, role) VALUES (?,?)", params).catch(()=>{});
  } else {
    await run("INSERT OR IGNORE INTO user_roles (user_id, role) VALUES (?,?)", params).catch(()=>{});
  }
}
async function removeUserRole(userId, role) {
  if (!role) return;
  await run("DELETE FROM user_roles WHERE user_id=? AND role=?", [userId, role]).catch(()=>{});
}
async function setUserRoles(userId, roles) {
  // roles: string | string[]
  const list = Array.isArray(roles) ? roles : (roles ? [String(roles)] : []);
  const current = await getUserRoles(userId);

  // add missing
  for (const r of list) {
    if (!current.includes(r)) await addUserRole(userId, r);
  }
  // remove extra
  for (const r of current) {
    if (!list.includes(r)) await removeUserRole(userId, r);
  }

  // keep users.role for backward-compat (first role or null)
  const main = list[0] || null;
  if (main !== null) await run("UPDATE users SET role=? WHERE id=?", [main, userId]).catch(()=>{});
}

/* =========================
   Router & endpoints
========================= */
import { requireAuth } from "./auth.js";
import { requireRole } from "../middlewares/roles.js";

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

/* ======================================================================
   1) USERS
====================================================================== */
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

  let items = await all(
    "SELECT id,email,name,avatar_url,role,address,phone,status,created_at FROM users " +
    whereSql + " ORDER BY created_at DESC LIMIT ? OFFSET ?",
    [...params, pageSize, offset]
  ).catch(()=>[]);
  const cnt = await get("SELECT COUNT(*) AS total FROM users " + whereSql, params).catch(()=>({ total: 0 }));

  // kèm danh sách roles (user_roles) — không phá API cũ
  for (const u of items) {
    u.roles = await getUserRoles(u.id).catch(()=>[]);
  }

  res.json({ items, total: Number(cnt?.total ?? 0), page, pageSize });
});

// Update user (name/status + role[s])
admin.patch("/users/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const uid = req.params.id;
  const { name, role, roles, status } = req.body || {};

  // 1) update basic fields
  const set = [], params = [];
  if (name   !== undefined) { set.push("name=?");   params.push(String(name)); }
  if (status !== undefined) { set.push("status=?"); params.push(String(status)); }
  if (set.length) {
    params.push(uid);
    await run("UPDATE users SET " + set.join(", ") + " WHERE id=?", params).catch(()=>{});
  }

  // 2) roles sync: nếu truyền "roles" (array) → ưu tiên; else nếu có "role" (string) → dùng 1 phần tử
  if (roles !== undefined || role !== undefined) {
    const next = roles !== undefined ? roles : (role !== undefined ? [String(role)] : []);
    await setUserRoles(uid, next);
  }

  await logAudit(req.user?.id, "admin.update_user", uid, { name, status, roles: roles ?? role });

  const row = await get(
    "SELECT id,email,name,avatar_url,role,address,phone,status,created_at FROM users WHERE id=?",
    [uid]
  ).catch(()=>null);
  if (row) row.roles = await getUserRoles(uid).catch(()=>[]);
  res.json(row ?? { ok: true });
});

// Add one role
admin.post("/users/:id/roles", requireAuth, requireRole("admin"), async (req, res) => {
  const uid = req.params.id;
  const r = String(req.body?.role || "").trim();
  if (!r) return res.status(400).json({ message: "Thiếu role" });
  await addUserRole(uid, r);
  // đảm bảo users.role có giá trị nếu đang rỗng
  const u = await get("SELECT role FROM users WHERE id=?", [uid]).catch(()=>null);
  if (!u?.role) await run("UPDATE users SET role=? WHERE id=?", [r, uid]).catch(()=>{});
  await logAudit(req.user?.id, "admin.add_user_role", uid, { role: r });
  res.json({ ok: true, roles: await getUserRoles(uid) });
});

// Remove one role
admin.delete("/users/:id/roles/:role", requireAuth, requireRole("admin"), async (req, res) => {
  const uid = req.params.id;
  const r = req.params.role;
  await removeUserRole(uid, r);
  // nếu users.role đúng bằng role vừa xoá → cập nhật lại theo role còn lại
  const remain = await getUserRoles(uid);
  if (!remain.includes((await get("SELECT role FROM users WHERE id=?", [uid]) )?.role)) {
    const main = remain[0] || null;
    if (main !== null) await run("UPDATE users SET role=? WHERE id=?", [main, uid]).catch(()=>{});
  }
  await logAudit(req.user?.id, "admin.remove_user_role", uid, { role: r });
  res.json({ ok: true, roles: remain });
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
  // xoá role mapping để sạch dữ liệu
  await run("DELETE FROM user_roles WHERE user_id=?", [req.params.id]).catch(()=>{});
  await logAudit(req.user?.id, "admin.delete_user", req.params.id, {});
  res.json({ ok: true });
});

/* ======================================================================
   2) FOODS
====================================================================== */
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

/* ======================================================================
   2b) POLICY (foods)
====================================================================== */
admin.get("/policy/foods", requireAuth, requireRole("admin"), async (_req, res) => {
  const rows = await all("SELECT k,v FROM site_settings WHERE k IN ('foods.min_expiry_hours','foods.max_radius_km')", []).catch(()=>[]);
  const obj = {}; for (const r of rows) obj[r.k] = r.v;
  res.json({
    min_expiry_hours: Number(obj["foods.min_expiry_hours"] ?? 0),
    max_radius_km: Number(obj["foods.max_radius_km"] ?? 5),
  });
});
admin.put("/policy/foods", requireAuth, requireRole("admin"), async (req, res) => {
  const { min_expiry_hours, max_radius_km } = req.body || {};
  const entries = [
    ["foods.min_expiry_hours", String(Number(min_expiry_hours ?? 0))],
    ["foods.max_radius_km", String(Number(max_radius_km ?? 5))]
  ];
  for (const [k,v] of entries) {
    if (useMySQL) {
      await run(
        `INSERT INTO site_settings (k, v, updated_at) VALUES (?, ?, ${nowExpr})
         ON DUPLICATE KEY UPDATE v=VALUES(v), updated_at=${nowExpr}`, [k, v]
      ).catch(()=>{});
    } else {
      const exist = await get("SELECT k FROM site_settings WHERE k=?", [k]).catch(()=>null);
      if (exist) await run(`UPDATE site_settings SET v=?, updated_at=${nowExpr} WHERE k=?`, [v, k]).catch(()=>{});
      else       await run(`INSERT INTO site_settings (k, v, updated_at) VALUES (?, ?, ${nowExpr})`, [k, v]).catch(()=>{});
    }
  }
  await logAudit(req.user?.id, "admin.update_food_policy", null, { min_expiry_hours, max_radius_km });
  res.json({ ok: true });
});

/* ======================================================================
   3) BOOKINGS
====================================================================== */
admin.get("/bookings", requireAuth, requireRole("admin"), async (req, res) => {
  const status   = String(req.query.status || "").trim();
  const donor    = String(req.query.donor || "").trim();
  const receiver = String(req.query.receiver || "").trim();
  const q        = String(req.query.q || "").trim();
  const page     = Math.max(1, Number(req.query.page || 1));
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize || 20)));
  const offset   = (page - 1) * pageSize;

  const variants = [];
  variants.push({
    sql: "SELECT id, donor_id, receiver_id, qty, status, created_at, updated_at, expires_at, item_id, note FROM bookings ORDER BY created_at DESC LIMIT ? OFFSET ?",
    params: [pageSize, offset]
  });
  variants.push({
    sql: "SELECT id, owner_id AS donor_id, requester_id AS receiver_id, quantity AS qty, status, created_at, updated_at, expire_at AS expires_at, item_id, note FROM bookings ORDER BY created_at DESC LIMIT ? OFFSET ?",
    params: [pageSize, offset]
  });

  let items = await tryAll(variants);
  if (status)   items = items.filter(r => String(r.status||"").toLowerCase() === status.toLowerCase());
  if (donor)    items = items.filter(r => String(r.donor_id||"") === donor);
  if (receiver) items = items.filter(r => String(r.receiver_id||"") === receiver);
  if (q)        items = items.filter(r => JSON.stringify(r).toLowerCase().includes(q.toLowerCase()));

  const total = items.length;
  res.json({ items, total, page, pageSize });
});
admin.patch("/bookings/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const id = req.params.id;
  const { status, qty, note } = req.body || {};
  const variants = [];
  const set = [];
  const params = [];
  if (status !== undefined) { set.push("status=?"); params.push(String(status)); }
  if (qty    !== undefined) { set.push("qty=?");    params.push(Number(qty)); }
  if (note   !== undefined) { set.push("note=?");   params.push(String(note)); }
  if (set.length) variants.push({ sql: `UPDATE bookings SET ${set.join(", ")}, updated_at=${nowExpr} WHERE id=?`, params: [...params, id] });
  if (qty !== undefined) variants.push({ sql: `UPDATE bookings SET quantity=?, updated_at=${nowExpr} WHERE id=?`, params: [Number(qty), id] });

  const ok = await tryRun(variants);
  if (!ok) return res.status(500).json({ message: "Không cập nhật được booking (schema khác?)." });
  await logAudit(req.user?.id, "admin.update_booking", id, { status, qty });
  res.json({ ok: true });
});
admin.post("/bookings/auto-cancel", requireAuth, requireRole("admin"), async (req, res) => {
  const hours = Math.max(1, Number(req.body?.pending_hours || 24));
  const v1 = await tryRun([{ sql:
    `UPDATE bookings SET status='cancelled', updated_at=${nowExpr}
       WHERE status IN ('pending','requested','new')
         AND TIMESTAMPDIFF(HOUR, created_at, ${nowExpr}) >= ?`, params: [hours]
  }]);
  const v2 = await tryRun([{ sql:
    `UPDATE bookings SET status='cancelled', updated_at=${nowExpr}
       WHERE status IN ('pending','requested','new')
         AND (julianday(${nowExpr}) - julianday(created_at)) * 24 >= ?`, params: [hours]
  }]);
  const changed = v1 || v2;
  await logAudit(req.user?.id, "admin.autocancel_bookings", null, { hours });
  res.json({ ok: true, changed: !!changed });
});

/* ======================================================================
   4) DELIVERIES
====================================================================== */
admin.get("/deliveries", requireAuth, requireRole("admin"), async (req, res) => {
  const status = String(req.query.status || "").trim().toLowerCase();
  const rows = await tryAll([
    { sql: "SELECT id, booking_id, shipper_id, status, qty, created_at, updated_at FROM deliveries ORDER BY id DESC" },
    { sql: "SELECT id, booking_id, driver_id AS shipper_id, status, quantity AS qty, created_at, updated_at FROM deliveries ORDER BY id DESC" },
  ]);
  const items = status ? rows.filter(r => String(r.status||"").toLowerCase() === status) : rows;
  res.json(items);
});
admin.post("/deliveries/assign", requireAuth, requireRole("admin"), async (req, res) => {
  const booking_id = req.body?.booking_id;
  const shipper_id = req.body?.shipper_id;
  if (!booking_id || !shipper_id) return res.status(400).json({ message: "Thiếu booking_id/shipper_id" });

  const b = await tryGet([
    { sql: "SELECT id, qty FROM bookings WHERE id=?", params: [booking_id] },
    { sql: "SELECT id, quantity AS qty FROM bookings WHERE id=?", params: [booking_id] },
  ]);
  if (!b) return res.status(404).json({ message: "Booking không tồn tại" });

  const ok = await tryRun([
    { sql: `INSERT INTO deliveries (booking_id, shipper_id, status, qty, created_at) VALUES (?,?, 'assigned', ?, ${nowExpr})`, params: [booking_id, shipper_id, Number(b.qty||0)] },
    { sql: `INSERT INTO deliveries (booking_id, driver_id , status, quantity, created_at) VALUES (?,?, 'assigned', ?, ${nowExpr})`, params: [booking_id, shipper_id, Number(b.qty||0)] },
  ]);
  if (!ok) return res.status(500).json({ message: "Không tạo được delivery (schema khác?)." });

  await logAudit(req.user?.id, "admin.assign_shipper", String(booking_id), { shipper_id });
  res.json({ ok: true });
});
admin.patch("/deliveries/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const id = req.params.id;
  const { status, qty } = req.body || {};
  const ok = await tryRun([
    { sql: `UPDATE deliveries SET ${status!==undefined?"status=?,":""} ${qty!==undefined?"qty=?,":""} updated_at=${nowExpr} WHERE id=?`,
      params: [ ...(status!==undefined?[String(status)]:[]), ...(qty!==undefined?[Number(qty)]:[]), id] },
    { sql: `UPDATE deliveries SET ${status!==undefined?"status=?,":""} ${qty!==undefined?"quantity=?,":""} updated_at=${nowExpr} WHERE id=?`,
      params: [ ...(status!==undefined?[String(status)]:[]), ...(qty!==undefined?[Number(qty)]:[]), id] },
  ]);
  if (!ok) return res.status(500).json({ message: "Không cập nhật được delivery." });
  await logAudit(req.user?.id, "admin.update_delivery", id, { status, qty });
  res.json({ ok: true });
});

/* ======================================================================
   4b) PICKUP POINTS
====================================================================== */
admin.get("/pickup-points", requireAuth, requireRole("admin"), async (req, res) => {
  const q = String(req.query.q || "").trim();
  const rows = await all(
    "SELECT id, name, address, lat, lng, active, created_at, updated_at FROM pickup_points ORDER BY id DESC", []
  ).catch(()=>[]);
  const items = q ? rows.filter(r => (r.name||"").toLowerCase().includes(q.toLowerCase())) : rows;
  res.json(items);
});
admin.post("/pickup-points", requireAuth, requireRole("admin"), async (req, res) => {
  const { name, address, lat, lng, active } = req.body || {};
  if (!name) return res.status(400).json({ message: "Thiếu name" });
  await run(
    `INSERT INTO pickup_points (name, address, lat, lng, active, created_at)
     VALUES (?,?,?,?,?, ${nowExpr})`,
    [String(name), String(address || ""), lat ?? null, lng ?? null, Number(active ? 1 : 0)]
  ).catch(()=>{});
  await logAudit(req.user?.id, "admin.create_pickup_point", null, { name });
  res.json({ ok: true });
});
admin.patch("/pickup-points/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const { name, address, lat, lng, active } = req.body || {};
  const set = [], params = [];
  if (name    !== undefined) { set.push("name=?");    params.push(String(name)); }
  if (address !== undefined) { set.push("address=?"); params.push(String(address)); }
  if (lat     !== undefined) { set.push("lat=?");     params.push(lat ?? null); }
  if (lng     !== undefined) { set.push("lng=?");     params.push(lng ?? null); }
  if (active  !== undefined) { set.push("active=?");  params.push(Number(active?1:0)); }
  if (!set.length) return res.json({ ok: true });
  set.push(`updated_at=${nowExpr}`);
  params.push(req.params.id);
  await run("UPDATE pickup_points SET " + set.join(", ") + " WHERE id=?", params).catch(()=>{});
  await logAudit(req.user?.id, "admin.update_pickup_point", req.params.id, { name, active });
  res.json({ ok: true });
});
admin.delete("/pickup-points/:id", requireAuth, requireRole("admin"), async (req, res) => {
  await run("DELETE FROM pickup_points WHERE id=?", [req.params.id]).catch(()=>{});
  await logAudit(req.user?.id, "admin.delete_pickup_point", req.params.id, {});
  res.json({ ok: true });
});

/* ======================================================================
   3c/5.7) METRICS
====================================================================== */
admin.get("/metrics/delivery-success", requireAuth, requireRole("admin"), async (_req, res) => {
  const rows = await tryAll([
    { sql: "SELECT status, COUNT(*) AS c FROM deliveries GROUP BY status" },
    { sql: "SELECT status, COUNT(*) AS c FROM deliveries GROUP BY status" },
  ]);
  const byStatus = {}; for (const r of rows) byStatus[String(r.status||"unknown")] = Number(r.c||0);
  const delivered = (byStatus.delivered||0) + (byStatus.done||0) + (byStatus.completed||0);
  const total = Object.values(byStatus).reduce((a,b)=>a+b,0);
  const rate = total ? delivered / total : 0;
  res.json({ byStatus, delivered, total, success_rate: rate });
});

admin.get("/metrics/heatmap", requireAuth, requireRole("admin"), async (_req, res) => {
  const foods = await tryAll([
    { sql: "SELECT COALESCE(lat, location_lat) AS lat, COALESCE(lng, location_lng) AS lng FROM food_items WHERE COALESCE(lat,location_lat) IS NOT NULL AND COALESCE(lng,location_lng) IS NOT NULL" }
  ]);
  const bookings = await tryAll([
    { sql: "SELECT fi.lat, fi.lng FROM bookings b JOIN food_items fi ON fi.id=b.item_id WHERE fi.lat IS NOT NULL AND fi.lng IS NOT NULL" }
  ]);
  const bucket = (x) => Math.round((Number(x)||0) / 0.02) * 0.02;
  const agg = {};
  for (const p of foods) { const k = `${bucket(p.lat)},${bucket(p.lng)}`; agg[k] = (agg[k]||0)+1; }
  for (const p of bookings) { const k = `${bucket(p.lat)},${bucket(p.lng)}`; agg[k] = (agg[k]||0)+1; }
  const cells = Object.entries(agg).map(([k,v]) => { const [lat,lng] = k.split(",").map(Number); return { lat, lng, count: v }; });
  res.json({ cells });
});

/* ======================================================================
   3d) FOODS EXPIRE NOW
====================================================================== */
admin.post("/foods/expire-now", requireAuth, requireRole("admin"), async (_req, res) => {
  const ok = await tryRun([
    { sql: `UPDATE food_items SET status='expired' WHERE expires_at IS NOT NULL AND expires_at <= ${nowExpr}` },
    { sql: `UPDATE food_items SET status='expired' WHERE expire_at  IS NOT NULL AND expire_at  <= ${nowExpr}` },
  ]);
  await logAudit(null, "admin.expire_foods_now", null, {});
  res.json({ ok: !!ok });
});

/* ======================================================================
   3e) PAYMENTS
====================================================================== */
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
  await run(`UPDATE payments SET status=?, updated_at=${nowExpr} WHERE id=?`, [String(status), req.params.id]).catch(()=>{});
  await logAudit(req.user?.id, "admin.update_payment", req.params.id, { status });
  res.json({ ok: true });
});

/* ======================================================================
   5) SITE SETTINGS + RECO
====================================================================== */
admin.get("/settings", requireAuth, requireRole("admin"), async (_req, res) => {
  const rows = await all("SELECT k, v FROM site_settings", []).catch(()=>[]);
  const data = {}; for (const r of rows) data[r.k] = r.v; res.json(data);
});
admin.put("/settings", requireAuth, requireRole("admin"), async (req, res) => {
  const entries = Object.entries(req.body || {});
  for (const [k, v] of entries) {
    const val = typeof v === "string" ? v : JSON.stringify(v);
    if (useMySQL) {
      await run(
        `INSERT INTO site_settings (k, v, updated_at) VALUES (?, ?, ${nowExpr})
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

admin.get("/reco-config", requireAuth, requireRole("admin"), async (_req, res) => {
  const row = await get("SELECT v FROM site_settings WHERE k='reco.weights'", []).catch(()=>null);
  let defaults = { distance: 0.45, expiry: 0.40, diet: 0.15 };
  if (row?.v) { try { defaults = JSON.parse(row.v); } catch {} }
  res.json(defaults);
});
admin.put("/reco-config", requireAuth, requireRole("admin"), async (req, res) => {
  const payload = req.body || {};
  const v = JSON.stringify(payload);
  if (useMySQL) {
    await run(
      `INSERT INTO site_settings (k, v, updated_at) VALUES ('reco.weights', ?, ${nowExpr})
       ON DUPLICATE KEY UPDATE v=VALUES(v), updated_at=${nowExpr}`, [v]
    ).catch(()=>{});
  } else {
    const exists = await get("SELECT k FROM site_settings WHERE k='reco.weights'", []).catch(()=>null);
    if (exists) await run(`UPDATE site_settings SET v=?, updated_at=${nowExpr} WHERE k='reco.weights'`, [v]).catch(()=>{});
    else        await run(`INSERT INTO site_settings (k, v, updated_at) VALUES ('reco.weights', ?, ${nowExpr})`, [v]).catch(()=>{});
  }
  await logAudit(req.user?.id, "admin.update_reco_config", null, payload);
  res.json({ ok: true });
});

/* ======================================================================
   6) ANNOUNCEMENTS
====================================================================== */
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
     VALUES (?,?,?, ?, ${nowExpr})`,
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

/* ======================================================================
   7) CMS PAGES
====================================================================== */
admin.get("/pages", requireAuth, requireRole("admin"), async (_req, res) => {
  const rows = await all(
    "SELECT id, slug, title, status, created_at, updated_at FROM cms_pages ORDER BY id DESC", []
  ).catch(()=>[]);
  res.json(rows);
});
admin.get("/pages/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const row = await get("SELECT * FROM cms_pages WHERE id=?", [req.params.id]).catch(()=>null);
  if (!row) return res.status(404).json({ message: "Page not found" });
  res.json(row);
});
admin.post("/pages", requireAuth, requireRole("admin"), async (req, res) => {
  const { slug, title, content, status } = req.body || {};
  if (!slug || !title) return res.status(400).json({ message: "Thiếu slug/title" });
  await run(
    `INSERT INTO cms_pages (slug, title, content, status, created_at) VALUES (?,?,?,?, ${nowExpr})`,
    [String(slug), String(title), String(content||""), String(status||"draft")]
  ).catch(()=>{});
  await logAudit(req.user?.id, "admin.create_page", null, { slug });
  res.json({ ok: true });
});
admin.patch("/pages/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const { slug, title, content, status } = req.body || {};
  const set = [], params = [];
  if (slug    !== undefined) { set.push("slug=?");    params.push(String(slug)); }
  if (title   !== undefined) { set.push("title=?");   params.push(String(title)); }
  if (content !== undefined) { set.push("content=?"); params.push(String(content)); }
  if (status  !== undefined) { set.push("status=?");  params.push(String(status)); }
  if (!set.length) return res.json({ ok: true });
  set.push(`updated_at=${nowExpr}`);
  params.push(req.params.id);
  await run("UPDATE cms_pages SET " + set.join(", ") + " WHERE id=?", params).catch(()=>{});
  await logAudit(req.user?.id, "admin.update_page", req.params.id, { slug, status });
  res.json({ ok: true });
});
admin.delete("/pages/:id", requireAuth, requireRole("admin"), async (req, res) => {
  await run("DELETE FROM cms_pages WHERE id=?", [req.params.id]).catch(()=>{});
  await logAudit(req.user?.id, "admin.delete_page", req.params.id, {});
  res.json({ ok: true });
});

/* ======================================================================
   8) IMPERSONATE
====================================================================== */
admin.post("/impersonate", requireAuth, requireRole("admin"), async (req, res) => {
  const userId = String(req.body?.user_id || "");
  if (!userId) return res.status(400).json({ message: "Thiếu user_id" });
  const user = await get("SELECT id,email,name,role FROM users WHERE id=?", [userId]).catch(()=>null);
  if (!user) return res.status(404).json({ message: "User not found" });
  const payload = { id: user.id, uid: user.id, email: user.email, role: user.role, imp_by: req.user?.id };
  const token = jwt.sign(payload, process.env.JWT_SECRET || "dev_secret", { expiresIn: "10m" });
  await logAudit(req.user?.id, "admin.impersonate", userId, { as: user.email });
  res.json({ token, user });
});

/* ======================================================================
   9) REPORTS
====================================================================== */
admin.get("/reports", requireAuth, requireRole("admin"), async (req, res) => {
  const status   = String(req.query.status || "").trim();
  const q        = String(req.query.q || "").trim();
  const page     = Math.max(1, Number(req.query.page || 1));
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize || 20)));
  const offset   = (page - 1) * pageSize;

  const where = [], params = [];
  if (status && status !== "all") { where.push("status=?"); params.push(status); }
  if (q) {
    where.push("(reason LIKE ? OR notes LIKE ? OR reporter_id LIKE ? OR target_user_id LIKE ? OR target_item_id LIKE ?)");
    params.push(likeWrap(q), likeWrap(q), likeWrap(q), likeWrap(q), likeWrap(q));
  }
  const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";

  const items = await all(
    "SELECT id, reporter_id, target_user_id, target_item_id, reason, status, notes, created_at, resolved_at " +
    "FROM reports " + whereSql + " ORDER BY id DESC LIMIT ? OFFSET ?",
    [...params, pageSize, offset]
  ).catch(()=>[]);
  const cnt = await get("SELECT COUNT(*) AS total FROM reports " + whereSql, params).catch(()=>({ total: 0 }));

  res.json({ items, total: Number(cnt?.total ?? 0), page, pageSize });
});
admin.get("/reports/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const r = await get(
    "SELECT id, reporter_id, target_user_id, target_item_id, reason, status, notes, created_at, resolved_at FROM reports WHERE id=?",
    [req.params.id]
  ).catch(()=>null);
  if (!r) return res.status(404).json({ message: "Report not found" });
  res.json(r);
});
admin.patch("/reports/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const { status, notes } = req.body || {};
  if (status === undefined && notes === undefined) return res.json({ ok: true });

  const set = [], params = [];
  if (status !== undefined) { set.push("status=?"); params.push(String(status)); }
  if (notes  !== undefined) { set.push("notes=?");  params.push(String(notes)); }
  const closing = ["resolved","closed","dismissed","rejected"].includes(String(status || "").toLowerCase());
  if (closing) set.push(`resolved_at=${nowExpr}`);
  params.push(req.params.id);

  await run("UPDATE reports SET " + set.join(", ") + " WHERE id=?", params).catch(()=>{});
  await logAudit(req.user?.id, "admin.update_report", req.params.id, { status, notes });
  res.json({ ok: true });
});
admin.post("/reports/:id/resolve", requireAuth, requireRole("admin"), async (req, res) => {
  const { notes } = req.body || {};
  await run(
    `UPDATE reports SET status='resolved', notes=?, resolved_at=${nowExpr} WHERE id=?`,
    [String(notes || ""), req.params.id]
  ).catch(()=>{});
  await logAudit(req.user?.id, "admin.resolve_report", req.params.id, { notes });
  res.json({ ok: true });
});
admin.post("/reports/:id/reopen", requireAuth, requireRole("admin"), async (req, res) => {
  await run(`UPDATE reports SET status='open', resolved_at=NULL WHERE id=?`, [req.params.id]).catch(()=>{});
  await logAudit(req.user?.id, "admin.reopen_report", req.params.id, {});
  res.json({ ok: true });
});

/* ======================================================================
   10) TASKS
====================================================================== */
admin.get("/tasks", requireAuth, requireRole("admin"), async (req, res) => {
  const parentId = req.query.parent === undefined || req.query.parent === "" ? null : Number(req.query.parent);
  const status   = String(req.query.status || "").trim();
  const type     = String(req.query.type || "").trim();
  const assignee = String(req.query.assignee || "").trim();
  const q        = String(req.query.q || "").trim();
  const page     = Math.max(1, Number(req.query.page || 1));
  const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize || 50)));
  const offset   = (page - 1) * pageSize;

  const where = [], params = [];
  if (parentId === null) { where.push("parent_id IS NULL"); }
  else if (!Number.isNaN(parentId)) { where.push("parent_id=?"); params.push(parentId); }
  if (status)   { where.push("status=?");     params.push(status); }
  if (type)     { where.push("type=?");       params.push(type); }
  if (assignee) { where.push("assignee_id=?");params.push(assignee); }
  if (q)        { where.push("(title LIKE ? OR description LIKE ?)"); params.push(likeWrap(q), likeWrap(q)); }
  const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";

  const items = await all(
    "SELECT id,parent_id,title,description,type,status,priority,assignee_id,sort_order,created_at,updated_at " +
    "FROM tasks " + whereSql + " ORDER BY sort_order ASC, id ASC LIMIT ? OFFSET ?",
    [...params, pageSize, offset]
  ).catch(()=>[]);
  const cnt = await get("SELECT COUNT(*) AS total FROM tasks " + whereSql, params).catch(()=>({ total: 0 }));
  res.json({ items, total: Number(cnt?.total ?? 0), page, pageSize });
});
admin.post("/tasks", requireAuth, requireRole("admin"), async (req, res) => {
  const { title, description, parent_id, type, status, priority, assignee_id } = req.body || {};
  if (!title) return res.status(400).json({ message: "Thiếu title" });

  const row = await get(
    "SELECT COALESCE(MAX(sort_order), -1) AS m FROM tasks WHERE " + (parent_id ? "parent_id=?" : "parent_id IS NULL"),
    parent_id ? [Number(parent_id)] : []
  ).catch(()=>({ m: -1 }));
  const nextOrder = Number(row?.m ?? -1) + 1;

  await run(
    `INSERT INTO tasks (parent_id,title,description,type,status,priority,assignee_id,sort_order,created_at)
     VALUES (?,?,?,?,?,?,?, ?, ${nowExpr})`,
    [
      parent_id ?? null,
      String(title),
      String(description || ""),
      String(type || "TASK"),
      String(status || "New"),
      String(priority || "Normal"),
      assignee_id ?? null,
      nextOrder
    ]
  ).catch(()=>{});
  await logAudit(req.user?.id, "admin.create_task", null, { title, parent_id });
  res.json({ ok: true });
});
admin.patch("/tasks/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const id = Number(req.params.id);
  const { title, description, type, status, priority, assignee_id, parent_id, sort_order } = req.body || {};
  const set = [], params = [];
  if (title       !== undefined) { set.push("title=?");       params.push(String(title)); }
  if (description !== undefined) { set.push("description=?"); params.push(String(description)); }
  if (type        !== undefined) { set.push("type=?");        params.push(String(type)); }
  if (status      !== undefined) { set.push("status=?");      params.push(String(status)); }
  if (priority    !== undefined) { set.push("priority=?");    params.push(String(priority)); }
  if (assignee_id !== undefined) { set.push("assignee_id=?"); params.push(assignee_id ?? null); }
  if (parent_id   !== undefined) { set.push("parent_id=?");   params.push(parent_id ?? null); }
  if (sort_order  !== undefined) { set.push("sort_order=?");  params.push(Number(sort_order)); }
  if (!set.length) return res.json({ ok: true });
  set.push(`updated_at=${nowExpr}`);
  params.push(id);

  await run("UPDATE tasks SET " + set.join(", ") + " WHERE id=?", params).catch(()=>{});
  await logAudit(req.user?.id, "admin.update_task", id, { title, status, parent_id, sort_order });
  res.json({ ok: true });
});
admin.post("/tasks/reorder", requireAuth, requireRole("admin"), async (req, res) => {
  const parent_id = req.body?.parent_id ?? null;
  const orders = Array.isArray(req.body?.orders) ? req.body.orders : [];
  for (const o of orders) {
    if (!o || typeof o.id === "undefined") continue;
    await run(
      "UPDATE tasks SET sort_order=?, updated_at=" + nowExpr + " WHERE id=? AND " +
      (parent_id === null ? "parent_id IS NULL" : "parent_id=?"),
      parent_id === null ? [Number(o.sort_order || 0), o.id] : [Number(o.sort_order || 0), o.id, Number(parent_id)]
    ).catch(()=>{});
  }
  await logAudit(req.user?.id, "admin.reorder_tasks", String(parent_id), { count: orders.length });
  res.json({ ok: true });
});
admin.get("/tasks/:id/comments", requireAuth, requireRole("admin"), async (req, res) => {
  const rows = await all(
    "SELECT id,task_id,author_id,content,created_at FROM task_comments WHERE task_id=? ORDER BY id ASC",
    [req.params.id]
  ).catch(()=>[]);
  res.json(rows);
});
admin.post("/tasks/:id/comments", requireAuth, requireRole("admin"), async (req, res) => {
  const content = String(req.body?.content || "").trim();
  if (!content) return res.status(400).json({ message: "Thiếu content" });
  await run(
    `INSERT INTO task_comments (task_id, author_id, content, created_at)
     VALUES (?, ?, ?, ${nowExpr})`,
    [req.params.id, req.user?.id ?? null, content]
  ).catch(()=>{});
  await logAudit(req.user?.id, "admin.comment_task", req.params.id, { content_len: content.length });
  res.json({ ok: true });
});

/* ======================================================================
   11) AUDIT LOGS
====================================================================== */
admin.get("/audit", requireAuth, requireRole("admin"), async (req, res) => {
  const actor  = String(req.query.actor || "").trim();
  const action = String(req.query.action || "").trim();
  const target = String(req.query.target || "").trim();
  const from   = String(req.query.from || "").trim();
  const to     = String(req.query.to || "").trim();
  const page   = Math.max(1, Number(req.query.page || 1));
  const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize || 50)));
  const offset   = (page - 1) * pageSize;

  const where = [], params = [];
  if (actor)  { where.push("actor_id=?"); params.push(actor); }
  if (action) { where.push("action LIKE ?"); params.push(likeWrap(action)); }
  if (target) { where.push("target_id LIKE ?"); params.push(likeWrap(target)); }
  if (from)   { where.push("created_at >= ?"); params.push(from); }
  if (to)     { where.push("created_at <= ?"); params.push(to); }
  const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";

  const items = await all(
    "SELECT id, actor_id, action, target_id, detail, created_at FROM audit_logs " +
    whereSql + " ORDER BY id DESC LIMIT ? OFFSET ?",
    [...params, pageSize, offset]
  ).catch(()=>[]);
  const cnt = await get("SELECT COUNT(*) AS total FROM audit_logs " + whereSql, params).catch(()=>({ total: 0 }));
  res.json({ items, total: Number(cnt?.total ?? 0), page, pageSize });
});
admin.get("/audit/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const row = await get("SELECT id, actor_id, action, target_id, detail, created_at FROM audit_logs WHERE id=?", [req.params.id]).catch(()=>null);
  if (!row) return res.status(404).json({ message: "Audit not found" });
  res.json(row);
});

/* ======================================================================
   12) BACKUP / RESTORE (JSON)
====================================================================== */
admin.get("/backup", requireAuth, requireRole("admin"), async (_req, res) => {
  const pack = {};
  async function grab(name, sql) { pack[name] = await all(sql).catch(()=>[]); }
  await grab("users", "SELECT * FROM users");
  await grab("food_items", "SELECT * FROM food_items");
  await grab("bookings", "SELECT * FROM bookings");
  await grab("deliveries", "SELECT * FROM deliveries");
  await grab("campaigns", "SELECT * FROM campaigns");
  await grab("payments", "SELECT * FROM payments");
  await grab("pickup_points", "SELECT * FROM pickup_points");
  await grab("cms_pages", "SELECT * FROM cms_pages");
  await grab("tasks", "SELECT * FROM tasks");
  await grab("task_comments", "SELECT * FROM task_comments");
  await grab("reports", "SELECT * FROM reports");
  await grab("user_roles", "SELECT * FROM user_roles");
  res.json({ ok: true, exported_at: new Date().toISOString(), tables: pack });
});
admin.post("/restore", requireAuth, requireRole("admin"), async (req, res) => {
  const tables = req.body?.tables || {};
  const keys = Object.keys(tables);
  for (const name of keys) {
    const rows = Array.isArray(tables[name]) ? tables[name] : [];
    for (const r of rows) {
      const cols = Object.keys(r);
      const placeholders = cols.map(()=>"?").join(",");
      const sql = `INSERT OR IGNORE INTO ${name} (${cols.join(",")}) VALUES (${placeholders})`;
      await run(sql.replace("INSERT OR IGNORE","INSERT IGNORE"), cols.map(c=>r[c])).catch(async ()=>{
        await run(sql, cols.map(c=>r[c])).catch(()=>{});
      });
    }
  }
  await logAudit(req.user?.id, "admin.restore_json", null, { tables: keys });
  res.json({ ok: true, imported: keys.length });
});

/* ======================================================================
   13) CAMPAIGNS — list
====================================================================== */
admin.get("/campaigns", requireAuth, requireRole("admin"), async (req, res) => {
  res.set("Cache-Control", "no-store");

  const q        = String(req.query.q || "").trim();
  const status   = String(req.query.status || "").trim();
  const page     = Math.max(1, Number(req.query.page || 1));
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize || 10)));
  const offset   = (page - 1) * pageSize;

  const where = [];
  const params = [];
  if (q)     { where.push("(title LIKE ? OR description LIKE ?)"); params.push(`%${q}%`, `%${q}%`); }
  if (status){ where.push("status = ?");                           params.push(status); }
  const W = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const LIMIT  = pageSize | 0;
  const OFFSET = offset  | 0;

  try {
    const cntRow = await get(`SELECT COUNT(*) AS total FROM campaigns ${W}`, params);
    const total = Number(cntRow?.total || 0);

    let items = await all(
      `
      SELECT
        id,
        title,
        IFNULL(description, '')               AS description,
        IFNULL(cover_url, '')                 AS cover_url,
        IFNULL(status, 'draft')               AS status,
        IFNULL(target_amount, 0)              AS target_amount,
        IFNULL(raised_amount, 0)              AS raised_amount,
        deadline,
        created_at
      FROM campaigns
      ${W}
      ORDER BY created_at DESC
      LIMIT ${LIMIT} OFFSET ${OFFSET}
      `,
      params
    );

    if (total > 0 && (!items || items.length === 0)) {
      items = await all(
        `
        SELECT
          id,
          title,
          IFNULL(description, '')   AS description,
          IFNULL(cover_url, '')     AS cover_url,
          IFNULL(status, 'draft')   AS status,
          IFNULL(target_amount, 0)  AS target_amount,
          IFNULL(raised_amount, 0)  AS raised_amount,
          deadline,
          created_at
        FROM campaigns
        ORDER BY created_at DESC
        LIMIT ${LIMIT} OFFSET ${OFFSET}
        `,
        []
      );
      console.warn("[admin/campaigns] Fallback query used. total:", total, "items:", items.length);
    }

    if (!Array.isArray(items)) items = [];

    res.json({ items, total, page, pageSize });
  } catch (e) {
    console.error("[/api/admin/campaigns] error:", e);
    res.status(500).json({ message: "Không tải được danh sách chiến dịch." });
  }
});

export default admin;
