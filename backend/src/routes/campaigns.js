import { Router } from "express";
import crypto from "crypto";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const useMySQL = (process.env.DB_DRIVER || "sqlite") === "mysql";
let db;
if (useMySQL) {
  ({ db } = await import("../lib/db.mysql.js"));
} else {
  ({ db } = await import("../lib/db.js"));
}

const router = Router();

/* ---------------- Helpers ---------------- */
async function dbGet(sql, params = []) {
  return useMySQL
    ? await db.get(sql, params)
    : db.prepare(sql).get(...params);
}
async function dbAll(sql, params = []) {
  return useMySQL
    ? await db.all(sql, params)
    : db.prepare(sql).all(...params);
}
async function dbRun(sql, params = []) {
  return useMySQL
    ? await db.run(sql, params)
    : db.prepare(sql).run(...params);
}
function safeTags(raw) {
  try {
    if (!raw) return [];
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return [];
  }
}

/* ---------------- GET /api/campaigns (list) ---------------- */
/* query: q, status=active|closed|all, sort=latest|progress|goal, page, pageSize */
router.get("/", async (req, res) => {
  try {
    const { q = "", status = "active", sort = "latest" } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize) || 8));
    const offset = (page - 1) * pageSize;

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
    const whereSQL = where.length ? "WHERE " + where.join(" AND ") : "";

    const sortSQL =
      sort === "progress"
        ? "CASE WHEN goal>0 THEN (raised*1.0/goal) ELSE 0 END DESC, created_at DESC"
        : sort === "goal"
        ? "goal DESC, created_at DESC"
        : "created_at DESC";

    const listSQL = `
      SELECT id, title, description, location, goal, raised, supporters,
             tags, cover, status, created_at, updated_at
        FROM campaigns
        ${whereSQL}
        ORDER BY ${sortSQL}
        LIMIT ? OFFSET ?`;

    const countSQL = `SELECT COUNT(*) AS total FROM campaigns ${whereSQL}`;

    const totalRow = await dbGet(countSQL, params);
    const rows = await dbAll(listSQL, [...params, pageSize, offset]);

    rows.forEach(r => { r.tags = safeTags(r.tags); });

    res.json({ ok: true, items: rows, total: Number(totalRow?.total || 0), page, pageSize });
  } catch (err) {
    console.error("[GET /api/campaigns] error:", err);
    res.status(500).json({ ok: false, message: "Không lấy được danh sách chiến dịch" });
  }
});

/* ---------------- GET /api/campaigns/stats ---------------- */
router.get("/stats", async (_req, res) => {
  try {
    const sql = `
      SELECT COUNT(*) AS campaigns,
             SUM(raised) AS raised,
             SUM(supporters) AS supporters,
             SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) AS active
        FROM campaigns`;
    const row = await dbGet(sql, []);
    res.json({
      ok: true,
      campaigns: Number(row?.campaigns || 0),
      raised: Number(row?.raised || 0),
      supporters: Number(row?.supporters || 0),
      active: Number(row?.active || 0),
    });
  } catch (err) {
    console.error("[GET /api/campaigns/stats] error:", err);
    res.status(500).json({ ok: false, message: "Không lấy được thống kê chiến dịch" });
  }
});

/* ---------------- POST /api/campaigns (admin only) ---------------- */
router.post("/", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const id = crypto.randomUUID();
    const {
      title, description = "", location = "", goal = 0, raised = 0,
      supporters = 0, tags = [], cover = "", status = "active"
    } = req.body || {};

    const sql = `
      INSERT INTO campaigns (id, title, description, location, goal, raised, supporters,
                             tags, cover, status, created_at)
      VALUES (?,?,?,?,?,?,?,?,?, ?, CURRENT_TIMESTAMP)`;
    const args = [id, title, description, location, goal, raised, supporters,
                  JSON.stringify(tags), cover, status];

    await dbRun(sql, args);

    const row = await dbGet("SELECT * FROM campaigns WHERE id=?", [id]);
    row.tags = safeTags(row.tags);

    res.status(201).json({ ok: true, ...row });
  } catch (err) {
    console.error("[POST /api/campaigns] error:", err);
    res.status(500).json({ ok: false, message: "Tạo chiến dịch thất bại" });
  }
});

/* ---------------- PATCH /api/campaigns/:id (admin only) ---------------- */
router.patch("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const id = req.params.id;
    const cur = await dbGet("SELECT * FROM campaigns WHERE id=?", [id]);
    if (!cur) return res.status(404).json({ ok: false, message: "Not found" });

    const c = { ...cur, ...req.body };
    const sql = `
      UPDATE campaigns SET
        title=?, description=?, location=?, goal=?, raised=?, supporters=?,
        tags=?, cover=?, status=?,
        updated_at=CURRENT_TIMESTAMP
      WHERE id=?`;
    const args = [
      c.title, c.description || "", c.location || "",
      Number(c.goal||0), Number(c.raised||0), Number(c.supporters||0),
      JSON.stringify(c.tags||[]), c.cover||"", c.status||"active", id
    ];

    await dbRun(sql, args);

    const row = await dbGet("SELECT * FROM campaigns WHERE id=?", [id]);
    row.tags = safeTags(row.tags);

    res.json({ ok: true, ...row });
  } catch (err) {
    console.error("[PATCH /api/campaigns/:id] error:", err);
    res.status(500).json({ ok: false, message: "Cập nhật chiến dịch thất bại" });
  }
});

/* ---------------- DELETE /api/campaigns/:id (admin only) ---------------- */
router.delete("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const id = req.params.id;
    await dbRun("DELETE FROM campaigns WHERE id=?", [id]);
    res.status(204).end();
  } catch (err) {
    console.error("[DELETE /api/campaigns/:id] error:", err);
    res.status(500).json({ ok: false, message: "Xoá chiến dịch thất bại" });
  }
});

export default router;
