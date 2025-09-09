// backend/src/routes/admincampaigns.js  (ESM)
import { Router } from "express";
import "dotenv/config";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const useMySQL = (process.env.DB_DRIVER || "sqlite") === "mysql";
let db;
if (useMySQL) {
  ({ db } = await import("../lib/db.mysql.js"));
} else {
  ({ db } = await import("../lib/db.js"));
}

const router = Router();

/* ============== Helpers (reuse phong cách overview) ============== */
function sendError(res, status, code, message, details = undefined) {
  if (details) console.warn(`[${code}]`, details?.stack || details?.message || details);
  const payload = { ok: false, code, message };
  if (process.env.NODE_ENV !== "production" && details) payload.debug = String(details?.message || details);
  return res.status(status).json(payload);
}
async function dbGet(sql, params = []) {
  try {
    if (useMySQL) {
      if (typeof db.get === "function") return await db.get(sql, params);
      if (typeof db.query === "function") {
        const [rows] = await db.query(sql, params);
        return rows?.[0] ?? null;
      }
      throw new Error("MySQL adapter missing .get/.query");
    }
    return db.prepare(sql).get(...params);
  } catch (e) {
    throw new Error(`dbGet failed: ${e?.message || e}`);
  }
}
async function dbAll(sql, params = []) {
  try {
    if (useMySQL) {
      if (typeof db.all === "function") return await db.all(sql, params);
      if (typeof db.query === "function") {
        const [rows] = await db.query(sql, params);
        return rows ?? [];
      }
      throw new Error("MySQL adapter missing .all/.query");
    }
    return db.prepare(sql).all(...params);
  } catch (e) {
    throw new Error(`dbAll failed: ${e?.message || e}`);
  }
}
function toInt(v, def, min = -Infinity, max = Infinity) {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
}
function safeTags(raw) {
  try {
    if (!raw) return [];
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return [];
  }
}

/* ============== GET /api/admin/campaigns ============== */
/* query: q, status=active|draft|archived|all, page, pageSize, sort=latest|progress|goal */
router.get("/", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const status = String(req.query.status || "all").toLowerCase();
    const sort = String(req.query.sort || "latest").toLowerCase();
    const page = toInt(req.query.page, 1, 1, 1e6);
    const pageSize = toInt(req.query.pageSize, 10, 1, 100);
    const offset = (page - 1) * pageSize;

    const where = [];
    const params = [];
    if (q) {
      where.push("(title LIKE ? OR description LIKE ? OR location LIKE ?)");
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    if (status !== "all") {
      where.push("(status = ? OR (status IS NULL AND ?='active'))");
      params.push(status, status); // coi NULL là active
    }
    const whereSQL = where.length ? "WHERE " + where.join(" AND ") : "";

    const sortSQL =
      sort === "progress"
        ? "CASE WHEN goal>0 THEN (raised*1.0/goal) ELSE 0 END DESC, created_at DESC"
        : sort === "goal"
        ? "goal DESC, created_at DESC"
        : "created_at DESC";

    const items = await dbAll(
      `SELECT id, title, description, location, goal, raised, supporters,
              tags, cover, status, created_at, updated_at, deadline
         FROM campaigns
         ${whereSQL}
         ORDER BY ${sortSQL}
         LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );
    const tot = await dbGet(`SELECT COUNT(*) AS c FROM campaigns ${whereSQL}`, params);

    // Chuẩn hoá giống FE đang dùng: target_amount / raised_amount / cover_url
    const mapped = items.map((r) => ({
      ...r,
      tags: safeTags(r.tags),
      target_amount: Number(r.goal || 0),
      raised_amount: Number(r.raised || 0),
      cover_url: r.cover || "",
    }));

    return res.json({ ok: true, items: mapped, total: Number(tot?.c || 0), page, pageSize });
  } catch (err) {
    console.error("[GET /api/admin/campaigns] error:", err);
    return sendError(res, 500, "admin_campaigns_failed", "Không lấy được danh sách chiến dịch.", err);
  }
});

/* ============== POST /api/admin/campaigns (create) ============== */
router.post("/", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { title, description = "", location = "", status = "draft",
            target_amount = 0, raised_amount = 0, supporters = 0,
            cover_url = "", tags = [], deadline = null } = req.body || {};

    if (!title || !String(title).trim()) {
      return sendError(res, 422, "title_required", "Vui lòng nhập tiêu đề chiến dịch.");
    }

    const sql = `
      INSERT INTO campaigns (title, description, location, status, goal, raised, supporters, cover, tags, deadline, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?, CURRENT_TIMESTAMP)`;
    const args = [
      String(title).trim(),
      String(description || ""),
      String(location || ""),
      String(status || "draft"),
      Number(target_amount || 0),
      Number(raised_amount || 0),
      Number(supporters || 0),
      String(cover_url || ""),
      JSON.stringify(Array.isArray(tags) ? tags : []),
      deadline || null,
    ];

    const ret = await dbGet(
      useMySQL ? "SELECT LAST_INSERT_ID() AS id" : "SELECT COALESCE(MAX(id),0)+1 AS id FROM campaigns"
    );
    const insertedId = ret?.id;

    await (useMySQL
      ? dbAll(sql, args)
      : dbAll(`INSERT INTO campaigns (id, title, description, location, status, goal, raised, supporters, cover, tags, deadline, created_at)
               VALUES (?,?,?,?,?,?,?,?,?,?,?, datetime('now'))`, [insertedId, ...args]));

    const row = await dbGet("SELECT * FROM campaigns WHERE id=?", [insertedId]);
    return res.status(201).json({
      ok: true,
      ...row,
      cover_url: row?.cover || "",
      target_amount: row?.goal || 0,
      raised_amount: row?.raised || 0,
      tags: safeTags(row?.tags),
    });
  } catch (err) {
    console.error("[POST /api/admin/campaigns] error:", err);
    return sendError(res, 500, "create_failed", "Tạo chiến dịch thất bại.", err);
  }
});

/* ============== PATCH /api/admin/campaigns/:id (update) ============== */
router.patch("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const id = req.params.id;
    const cur = await dbGet("SELECT * FROM campaigns WHERE id=?", [id]);
    if (!cur) return sendError(res, 404, "not_found", "Không tìm thấy chiến dịch.");

    const payload = { ...cur, ...req.body };
    const sql = `
      UPDATE campaigns SET
        title=?, description=?, location=?, status=?, goal=?, raised=?, supporters=?,
        cover=?, tags=?, deadline=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=?`;
    const args = [
      String(payload.title || ""),
      String(payload.description || ""),
      String(payload.location || ""),
      String(payload.status || "draft"),
      Number(payload.target_amount ?? payload.goal ?? 0),
      Number(payload.raised_amount ?? payload.raised ?? 0),
      Number(payload.supporters ?? 0),
      String(payload.cover_url ?? payload.cover ?? ""),
      JSON.stringify(Array.isArray(payload.tags) ? payload.tags : []),
      payload.deadline || null,
      id,
    ];

    await dbAll(sql, args);

    const row = await dbGet("SELECT * FROM campaigns WHERE id=?", [id]);
    return res.json({
      ok: true,
      ...row,
      cover_url: row?.cover || "",
      target_amount: row?.goal || 0,
      raised_amount: row?.raised || 0,
      tags: safeTags(row?.tags),
    });
  } catch (err) {
    console.error("[PATCH /api/admin/campaigns/:id] error:", err);
    return sendError(res, 500, "update_failed", "Cập nhật chiến dịch thất bại.", err);
  }
});

/* ============== DELETE /api/admin/campaigns/:id (archive/soft delete) ============== */
router.delete("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const id = req.params.id;
    // soft-archive: đổi status thay vì xoá cứng
    await dbAll("UPDATE campaigns SET status='archived', updated_at=CURRENT_TIMESTAMP WHERE id=?", [id]);
    return res.status(204).end();
  } catch (err) {
    console.error("[DELETE /api/admin/campaigns/:id] error:", err);
    return sendError(res, 500, "archive_failed", "Lưu trữ chiến dịch thất bại.", err);
  }
});

export default router;
