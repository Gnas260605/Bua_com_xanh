import { Router } from "express";
import crypto from "crypto";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const useMySQL = (process.env.DB_DRIVER || "sqlite") === "mysql";
let db;
if (useMySQL) { ({ db } = await import("../lib/db.mysql.js")); }
else          { ({ db } = await import("../lib/db.js")); }

const router = Router();

/* ------------------------ GET /api/campaigns (list) ------------------------ */
/* query: q, status=active|closed|all, sort=latest|progress|goal, page, pageSize */
router.get("/", async (req, res) => {
  const { q = "", status = "active", sort = "latest", page = 1, pageSize = 8 } = req.query;
  const off = (Number(page) - 1) * Number(pageSize);

  const where = [];
  const params = [];

  if (q) {
    where.push("(title LIKE ? OR location LIKE ?)");
    params.push(`%${q}%`, `%${q}%`);
  }
  if (status !== "all") {
    where.push("status = ?");
    params.push(status);
  }

  const whereSQL = where.length ? ("WHERE " + where.join(" AND ")) : "";

  const sortSQL =
    sort === "progress" ? "CASE WHEN goal>0 THEN (raised*1.0/goal) ELSE 0 END DESC, created_at DESC" :
    sort === "goal"     ? "goal DESC, created_at DESC" :
                          "created_at DESC";

  const listSQL  = `
    SELECT id, title, location, goal, raised, supporters, tags, cover, status, created_at
    FROM campaigns
    ${whereSQL}
    ORDER BY ${sortSQL}
    LIMIT ? OFFSET ?
  `;

  const countSQL = `SELECT COUNT(*) AS total FROM campaigns ${whereSQL}`;

  const total = useMySQL ? (await db.get(countSQL, params)).total
                         :  db.prepare(countSQL).get(...params).total;

  const rows = useMySQL
    ? await db.all(listSQL, [...params, Number(pageSize), off])
    : db.prepare(listSQL).all(...params, Number(pageSize), off);

  rows.forEach(r => { try { r.tags = JSON.parse(r.tags || "[]"); } catch { r.tags = []; } });

  res.json({ items: rows, total, page: Number(page), pageSize: Number(pageSize) });
});

/* ------------------------ GET /api/campaigns/stats ------------------------- */
router.get("/stats", async (_req, res) => {
  const totalSQL = `
    SELECT COUNT(*) AS campaigns,
           SUM(raised) AS raised,
           SUM(supporters) AS supporters,
           SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) AS active
    FROM campaigns
  `;
  const row = useMySQL ? await db.get(totalSQL, []) : db.prepare(totalSQL).get();
  res.json({
    campaigns: Number(row?.campaigns || 0),
    raised: Number(row?.raised || 0),
    supporters: Number(row?.supporters || 0),
    active: Number(row?.active || 0),
  });
});

/* -------------------- POST /api/campaigns  (admin only) -------------------- */
router.post("/", requireAuth, requireRole("admin"), async (req, res) => {
  const id = crypto.randomUUID();
  const {
    title, location = "", goal = 0, raised = 0, supporters = 0,
    tags = [], cover = "", status = "active"
  } = req.body || {};

  const sql = `
    INSERT INTO campaigns (id, title, location, goal, raised, supporters, tags, cover, status, created_at)
    VALUES (?,?,?,?,?,?,?,?,?, CURRENT_TIMESTAMP)
  `;
  const args = [id, title, location, goal, raised, supporters, JSON.stringify(tags), cover, status];

  if (useMySQL) await db.run(sql, args);
  else db.prepare(sql).run(...args);

  const row = useMySQL
    ? await db.get("SELECT * FROM campaigns WHERE id=?", [id])
    : db.prepare("SELECT * FROM campaigns WHERE id=?").get(id);

  try { row.tags = JSON.parse(row.tags || "[]"); } catch { row.tags = []; }
  res.status(201).json(row);
});

/* ------------------ PATCH /api/campaigns/:id (admin only) ------------------ */
router.patch("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const id = req.params.id;

  // Lấy hiện tại
  const cur = useMySQL
    ? await db.get("SELECT * FROM campaigns WHERE id=?", [id])
    : db.prepare("SELECT * FROM campaigns WHERE id=?").get(id);
  if (!cur) return res.status(404).json({ message: "Not found" });

  const c = { ...cur, ...req.body };
  const sql = `
    UPDATE campaigns SET
      title=?, location=?, goal=?, raised=?, supporters=?,
      tags=?, cover=?, status=?
    WHERE id=?
  `;
  const args = [
    c.title, c.location, Number(c.goal||0), Number(c.raised||0), Number(c.supporters||0),
    JSON.stringify(c.tags||[]), c.cover||"", c.status||"active", id
  ];

  if (useMySQL) await db.run(sql, args);
  else db.prepare(sql).run(...args);

  const row = useMySQL
    ? await db.get("SELECT * FROM campaigns WHERE id=?", [id])
    : db.prepare("SELECT * FROM campaigns WHERE id=?").get(id);
  try { row.tags = JSON.parse(row.tags || "[]"); } catch { row.tags = []; }
  res.json(row);
});

/* ----------------- DELETE /api/campaigns/:id (admin only) ------------------ */
router.delete("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const id = req.params.id;
  const sql = "DELETE FROM campaigns WHERE id=?";
  if (useMySQL) await db.run(sql, [id]); else db.prepare(sql).run(id);
  res.status(204).end();
});

export default router;
