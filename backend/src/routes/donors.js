// src/routes/donor.js
import { Router } from "express";
import jwt from "jsonwebtoken";
import "dotenv/config";

const useMySQL = (process.env.DB_DRIVER || "sqlite") === "mysql";
let db;
if (useMySQL) { ({ db } = await import("../lib/db.mysql.js")); }
else          { ({ db } = await import("../lib/db.js")); }

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

/* ---------- helpers ---------- */
async function dbGet(sql, params = []) {
  if (useMySQL) { const [rows] = await db.query(sql, params); return rows?.[0] ?? null; }
  return db.prepare(sql).get(...params);
}
async function dbAll(sql, params = []) {
  if (useMySQL) { const [rows] = await db.query(sql, params); return rows ?? []; }
  return db.prepare(sql).all(...params);
}
async function dbRun(sql, params = []) {
  if (useMySQL) { const [r] = await db.query(sql, params); return r; }
  return db.prepare(sql).run(...params);
}
const nowSQL = useMySQL ? "NOW()" : "datetime('now')";
const uuidSQL = useMySQL ? "UUID()" : null;

/* ---------- auth ---------- */
async function requireUser(req, res, next) {
  try {
    const h = req.headers.authorization || "";
    const m = h.match(/^Bearer\s+(.+)$/i);
    if (!m) return res.status(401).json({ error: "Missing token" });
    const payload = jwt.verify(m[1], JWT_SECRET); // { id, email, role }
    const user = await dbGet(
      "SELECT id,name,email,avatar_url,address,status FROM users WHERE id=?",
      [payload.id]
    );
    if (!user) return res.status(401).json({ error: "Invalid user" });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
}

/* =========================================================
   0) Profile / Stats
========================================================= */
router.get("/me", requireUser, (req, res) => res.json(req.user));

router.get("/stats", requireUser, async (req, res) => {
  const uid = req.user.id;
  const money = await dbGet(
    `SELECT
       COALESCE(SUM(CASE WHEN status='success' AND type='money' THEN amount END),0) AS totalMoney,
       COALESCE(SUM(CASE WHEN status='success' AND type='food'  THEN qty    END),0) AS totalMeals
     FROM donations WHERE user_id=?`,
    [uid]
  );
  res.json({
    totalMoney: Number(money?.totalMoney || 0),
    totalMeals: Number(money?.totalMeals || 0),
  });
});

/* =========================================================
   1) CRUD món/bữa (table: food_items)
   Schema: owner_id, title, qty, expire_at, location_addr, images(JSON), status...
========================================================= */
// List
router.get("/food-items", requireUser, async (req, res) => {
  const uid = req.user.id;
  const rows = await dbAll(
    `SELECT * FROM food_items WHERE owner_id=? ORDER BY created_at DESC`,
    [uid]
  );
  const mapped = rows.map(r => ({
    id: r.id,
    name: r.title,
    portions: Number(r.qty || 0),
    best_by: r.expire_at,
    pickup_address: r.location_addr,
    photo_url: (Array.isArray(r.images) ? r.images[0] : null) || null,
    is_veg: Array.isArray(r.tags) ? r.tags.includes("veg") : false,
    status: r.status, created_at: r.created_at,
  }));
  res.json(mapped);
});

// Create
router.post("/food-items", requireUser, async (req, res) => {
  const uid = req.user.id;
  const {
    name = "", portions = 0, photo_url = "", is_veg = false,
    pickup_address = "", best_by = null, status = "available",
  } = req.body || {};
  const title = String(name || "").trim();
  const qty   = Number(portions || 0);
  const imagesJson = JSON.stringify(photo_url ? [photo_url] : []);
  const tagsJson   = JSON.stringify(is_veg ? ["veg"] : []);

  if (useMySQL) {
    await dbRun(
      `INSERT INTO food_items
       (id, owner_id, title, description, qty, unit, expire_at, location_addr, lat, lng, tags, images, status, visibility, created_at)
       VALUES (${uuidSQL}, ?, ?, NULL, ?, 'suat', ?, ?, NULL, NULL, CAST(? AS JSON), CAST(? AS JSON), ?, 'public', ${nowSQL})`,
      [uid, title, qty, best_by, pickup_address, tagsJson, imagesJson, status]
    );
  } else {
    const { v4: uuidv4 } = await import("uuid");
    const id = uuidv4();
    await dbRun(
      `INSERT INTO food_items
       (id, owner_id, title, description, qty, unit, expire_at, location_addr, lat, lng, tags, images, status, visibility, created_at)
       VALUES (?, ?, ?, NULL, ?, 'suat', ?, ?, NULL, NULL, json(?), json(?), ?, 'public', ${nowSQL})`,
      [id, uid, title, qty, best_by, pickup_address, tagsJson, imagesJson, status]
    );
  }
  const row = await dbGet(`SELECT * FROM food_items WHERE owner_id=? ORDER BY created_at DESC LIMIT 1`, [uid]);
  res.json({
    id: row.id,
    name: row.title,
    portions: Number(row.qty || 0),
    best_by: row.expire_at,
    pickup_address: row.location_addr,
    photo_url: (Array.isArray(row.images) ? row.images[0] : null) || null,
    is_veg: Array.isArray(row.tags) ? row.tags.includes("veg") : false,
    status: row.status, created_at: row.created_at,
  });
});

// Update
router.patch("/food-items/:id", requireUser, async (req, res) => {
  const uid = req.user.id;
  const id = String(req.params.id);
  const exists = await dbGet("SELECT id, tags, images FROM food_items WHERE id=? AND owner_id=?", [id, uid]);
  if (!exists) return res.status(404).json({ error: "Not found" });

  // map patch
  const allowMap = {
    name: "title",
    portions: "qty",
    best_by: "expire_at",
    pickup_address: "location_addr",
    status: "status"
  };
  const sets = []; const args = [];
  for (const [k, v] of Object.entries(req.body || {})) {
    if (k === "photo_url") {
      const imgs = Array.isArray(exists.images) ? exists.images.slice() : [];
      if (v && (!imgs.length || imgs[0] !== v)) imgs[0] = v;
      sets.push("images=?"); args.push(JSON.stringify(imgs));
    } else if (k === "is_veg") {
      const tags = Array.isArray(exists.tags) ? exists.tags.slice() : [];
      const idx = tags.indexOf("veg");
      if (v && idx < 0) tags.push("veg");
      if (!v && idx >= 0) tags.splice(idx, 1);
      sets.push("tags=?"); args.push(JSON.stringify(tags));
    } else if (allowMap[k]) {
      sets.push(`${allowMap[k]}=?`);
      args.push(k === "portions" ? Number(v || 0) : v ?? null);
    }
  }
  if (sets.length) { args.push(id, uid); await dbRun(`UPDATE food_items SET ${sets.join(",")} WHERE id=? AND owner_id=?`, args); }
  const row = await dbGet("SELECT * FROM food_items WHERE id=?", [id]);
  res.json({
    id: row.id,
    name: row.title,
    portions: Number(row.qty || 0),
    best_by: row.expire_at,
    pickup_address: row.location_addr,
    photo_url: (Array.isArray(row.images) ? row.images[0] : null) || null,
    is_veg: Array.isArray(row.tags) ? row.tags.includes("veg") : false,
    status: row.status, created_at: row.created_at,
  });
});

// Delete
router.delete("/food-items/:id", requireUser, async (req, res) => {
  const uid = req.user.id;
  const id = String(req.params.id);
  const own = await dbGet("SELECT id FROM food_items WHERE id=? AND owner_id=?", [id, uid]);
  if (!own) return res.status(404).json({ error: "Not found" });
  await dbRun("DELETE FROM food_items WHERE id=?", [id]);
  res.json({ ok: true });
});

/* =========================================================
   2) Bundle (bundles + bundle_items)
   Schema: bundles.owner_id, title, status; bundle_items.item_id
========================================================= */
router.post("/bundles", requireUser, async (req, res) => {
  const uid = req.user.id;
  const { name = "", description = "", food_item_ids = [] } = req.body || {};
  const ids = (Array.isArray(food_item_ids) ? food_item_ids : []).map(String);

  // create bundle
  let bundleId;
  if (useMySQL) {
    const r = await dbRun(
      `INSERT INTO bundles (id, owner_id, title, description, cover, tags, status, created_at)
       VALUES (${uuidSQL}, ?, ?, ?, NULL, CAST('[]' AS JSON), 'active', ${nowSQL})`,
      [uid, name, description]
    );
    const row = await dbGet("SELECT id FROM bundles WHERE owner_id=? ORDER BY created_at DESC LIMIT 1", [uid]);
    bundleId = row?.id;
  } else {
    const { v4: uuidv4 } = await import("uuid");
    bundleId = uuidv4();
    await dbRun(
      `INSERT INTO bundles (id, owner_id, title, description, cover, tags, status, created_at)
       VALUES (?, ?, ?, ?, NULL, json('[]'), 'active', ${nowSQL})`,
      [bundleId, uid, name, description]
    );
  }

  // attach items that belong to this user
  for (const fid of ids) {
    const ok = await dbGet("SELECT id FROM food_items WHERE id=? AND owner_id=?", [fid, uid]);
    if (ok) await dbRun("INSERT INTO bundle_items (bundle_id, item_id) VALUES (?,?)", [bundleId, fid]);
  }
  const bundle = await dbGet("SELECT * FROM bundles WHERE id=?", [bundleId]);
  res.json(bundle);
});

/* =========================================================
   3) Donations history (donations + campaigns)
========================================================= */
router.get("/donations", requireUser, async (req, res) => {
  const uid = req.user.id;
  const pageSize = Math.min(Number(req.query.pageSize || 20), 100);
  const page = Math.max(Number(req.query.page || 1), 1);
  const offset = (page - 1) * pageSize;

  const rows = await dbAll(
    `SELECT d.id, d.type, d.amount, d.qty, d.status, d.created_at,
            c.id AS campaign_id, c.title AS campaign_title, c.cover AS campaign_cover
       FROM donations d
  LEFT JOIN campaigns c ON c.id = d.campaign_id
      WHERE d.user_id = ?
   ORDER BY d.created_at DESC
      LIMIT ? OFFSET ?`,
    [uid, pageSize, offset]
  );
  res.json(rows.map(r => ({
    id: r.id,
    unit: r.type === "money" ? "money" : "meal",
    amount: r.type === "money" ? Number(r.amount || 0) : Number(r.qty || 0),
    status: r.status,
    created_at: r.created_at,
    campaign: { id: r.campaign_id, title: r.campaign_title, cover: r.campaign_cover },
  })));
});

/* =========================================================
   4) Pickup points (global list theo schema hiện tại)
   Lưu ý: bảng pickup_points KHÔNG có user_id => chỉ trả danh sách public
========================================================= */
router.get("/pickup-points", requireUser, async (_req, res) => {
  const items = await dbAll(`SELECT * FROM pickup_points WHERE status='active' ORDER BY created_at DESC`);
  res.json({ items, default_id: null });
});

/* =========================================================
   5) Support tickets (tasks + task_comments)
   Schema: tasks(id,title,description,type,status,assignee_id...), task_comments(task_id,author_id,content)
========================================================= */
router.get("/support/tickets", requireUser, async (req, res) => {
  const uid = req.user.id;
  const rows = await dbAll(
    `SELECT id, title, description, status, created_at
       FROM tasks
      WHERE type='SUPPORT' AND assignee_id=?
   ORDER BY created_at DESC`,
    [uid]
  );
  res.json(rows);
});

router.post("/support/tickets", requireUser, async (req, res) => {
  const uid = req.user.id;
  const { title = "", description = "" } = req.body || {};
  let inserted;
  if (useMySQL) {
    await dbRun(
      `INSERT INTO tasks (title, description, type, status, priority, assignee_id, sort_order, created_at)
       VALUES (?, ?, 'SUPPORT', 'New', 'Normal', ?, 0, ${nowSQL})`,
      [title, description, uid]
    );
    inserted = await dbGet(`SELECT * FROM tasks WHERE assignee_id=? ORDER BY created_at DESC LIMIT 1`, [uid]);
  } else {
    await dbRun(
      `INSERT INTO tasks (title, description, type, status, priority, assignee_id, sort_order, created_at)
       VALUES (?, ?, 'SUPPORT', 'New', 'Normal', ?, 0, ${nowSQL})`,
      [title, description, uid]
    );
    inserted = await dbGet(`SELECT * FROM tasks WHERE assignee_id=? ORDER BY created_at DESC LIMIT 1`, [uid]);
  }
  res.json(inserted);
});

router.get("/support/tickets/:id/comments", requireUser, async (req, res) => {
  const tid = Number(req.params.id);
  const rows = await dbAll(
    `SELECT id, task_id, author_id, content, created_at
       FROM task_comments WHERE task_id=? ORDER BY created_at ASC`,
    [tid]
  );
  res.json(rows);
});

router.post("/support/tickets/:id/comments", requireUser, async (req, res) => {
  const uid = req.user.id;
  const tid = Number(req.params.id);
  const { body = "" } = req.body || {};
  await dbRun(
    `INSERT INTO task_comments (task_id, author_id, content, created_at)
     VALUES (?,?,?, ${nowSQL})`,
    [tid, uid, String(body)]
  );
  const c = await dbGet(`SELECT * FROM task_comments WHERE task_id=? ORDER BY created_at DESC LIMIT 1`, [tid]);
  res.json(c);
});

export default router;
