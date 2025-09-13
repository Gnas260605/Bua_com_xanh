// backend/src/routes/campaigns.js  (public routes for FE) — synced with donations
import { Router } from "express";
import "dotenv/config";

const useMySQL = (process.env.DB_DRIVER || "sqlite") === "mysql";
let db;
if (useMySQL) {
  ({ db } = await import("../lib/db.mysql.js"));
} else {
  ({ db } = await import("../lib/db.js"));
}

const router = Router();

/* ========================= DB helpers ========================= */
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

/* ========================= Utils ========================= */
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const toNum = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
function parseJson(raw, fallback) {
  try {
    if (raw == null || raw === "") return fallback;
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return fallback;
  }
}
function normalizeTags(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Subquery/expr khác nhau giữa MySQL & SQLite */
const AGG = {
  // 2 cột tính theo donations thành công
  raisedCol: useMySQL
    ? `(SELECT COALESCE(SUM(d.amount),0) FROM donations d WHERE d.campaign_id=c.id AND d.status='success')`
    : `(SELECT COALESCE(SUM(d.amount),0) FROM donations d WHERE d.campaign_id=c.id AND d.status='success')`,
  supportersCol: useMySQL
    ? `(SELECT COUNT(*) FROM donations d WHERE d.campaign_id=c.id AND d.status='success')`
    : `(SELECT COUNT(*) FROM donations d WHERE d.campaign_id=c.id AND d.status='success')`,
  // Date format cho /:id/reports
  monthExpr: useMySQL
    ? `DATE_FORMAT(COALESCE(paid_at, created_at), '%Y-%m')`
    : `strftime('%Y-%m', COALESCE(paid_at, created_at))`,
};

function mapCampaignRow(r) {
  const meta = parseJson(r.tags, {});
  const type = meta?.type || r.type || "money";
  const cover_url = r.cover || r.cover_url || "";

  // Ghi đè raised/supporters bằng giá trị tính toán (nếu có)
  const raisedCalc = toNum(r.raised_calc ?? r.raised, 0);
  const supportersCalc = toNum(r.supporters_calc ?? r.supporters, 0);

  return {
    ...r,
    cover_url,
    target_amount: toNum(r.goal ?? r.target_amount, 0),
    raised_amount: raisedCalc,
    raised: raisedCalc,
    supporters: supportersCalc,
    tags: normalizeTags(r.tags),
    meta,
    type,
    meal_unit: meta?.meal?.unit || "phần",
    meal_target_qty: toNum(meta?.meal?.target_qty, 0),
    meal_received_qty: toNum(meta?.meal?.received_qty, 0),
    start_at: meta?.start_at || null,
    end_at: meta?.end_at || null,
    payment: meta?.payment || null,
  };
}

/* ========================= GET /api/campaigns ========================= */
router.get("/", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const status = String(req.query.status || "active").toLowerCase();
    const sort = String(req.query.sort || "latest").toLowerCase();
    const typeFilter = String(req.query.type || "").toLowerCase();
    const featured = String(req.query.featured || "").trim() === "1";
    const page = clamp(parseInt(req.query.page) || 1, 1, 1e6);
    const pageSize = clamp(parseInt(req.query.pageSize) || (featured ? 6 : 8), 1, 50);
    const offset = (page - 1) * pageSize;

    const where = [];
    const params = [];

    if (q) {
      where.push("(title LIKE ? OR description LIKE ? OR location LIKE ?)");
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    if (status !== "all") {
      where.push("status = ?");
      params.push(status);
    }
    const whereSQL = where.length ? "WHERE " + where.join(" AND ") : "";

    // Sắp xếp theo tiến độ dùng raised tính toán
    let orderSQL = "c.created_at DESC";
    if (sort === "progress") {
      orderSQL = `CASE WHEN c.goal>0 THEN (raised_calc*1.0/c.goal) ELSE 0 END DESC, c.created_at DESC`;
    } else if (sort === "goal") {
      orderSQL = "c.goal DESC, c.created_at DESC";
    } else if (sort === "endSoon") {
      orderSQL = "CASE WHEN c.deadline IS NULL THEN 1 ELSE 0 END ASC, c.deadline ASC, c.created_at DESC";
    }

    const listSQL = `
      SELECT
        c.id, c.title, c.description, c.location, c.goal,
        c.cover, c.tags, c.status, c.created_at, c.updated_at, c.deadline,
        ${AGG.raisedCol}    AS raised_calc,
        ${AGG.supportersCol} AS supporters_calc
      FROM campaigns c
      ${whereSQL}
      ORDER BY ${orderSQL}
      LIMIT ? OFFSET ?`;

    const countSQL = `SELECT COUNT(*) AS total FROM campaigns c ${whereSQL}`;

    const totalRow = await dbGet(countSQL, params);
    const rows = await dbAll(listSQL, [...params, pageSize, offset]);

    let items = rows.map(mapCampaignRow);
    if (typeFilter) items = items.filter((it) => (it.type || "money") === typeFilter);

    res.json({ ok: true, items, total: toNum(totalRow?.total, 0), page, pageSize });
  } catch (err) {
    console.error("[GET /api/campaigns] error:", err);
    res.status(500).json({ ok: false, message: "Không lấy được danh sách chiến dịch" });
  }
});

/* ========================= GET /api/campaigns/stats ========================= */
router.get("/stats", async (_req, res) => {
  try {
    // Thống kê dựa trên donations thành công để luôn khớp
    const row = await dbGet(
      `
      SELECT
        (SELECT COUNT(*) FROM campaigns) AS campaigns,
        (SELECT COALESCE(SUM(amount),0) FROM donations WHERE status='success') AS raised,
        (SELECT COUNT(*) FROM donations WHERE status='success') AS supporters,
        (SELECT COUNT(*) FROM campaigns WHERE status='active') AS active
      `,
      []
    );
    res.json({
      ok: true,
      campaigns: toNum(row?.campaigns, 0),
      raised: toNum(row?.raised, 0),
      supporters: toNum(row?.supporters, 0),
      active: toNum(row?.active, 0),
    });
  } catch (err) {
    console.error("[GET /api/campaigns/stats] error:", err);
    res.status(500).json({ ok: false, message: "Không lấy được thống kê chiến dịch" });
  }
});

/* ========================= GET /api/campaigns/:id ========================= */
router.get("/:id", async (req, res) => {
  try {
    const id = req.params.id;

    const row = await dbGet(
      `
      SELECT
        c.id, c.title, c.description, c.location, c.goal,
        c.cover, c.tags, c.status, c.created_at, c.updated_at, c.deadline,
        ${AGG.raisedCol}    AS raised_calc,
        ${AGG.supportersCol} AS supporters_calc
      FROM campaigns c
      WHERE c.id=?
      `,
      [id]
    );

    if (!row) return res.status(404).json({ ok: false, message: "Not found" });
    res.json({ ok: true, ...mapCampaignRow(row) });
  } catch (err) {
    console.error("[GET /api/campaigns/:id] error:", err);
    res.status(500).json({ ok: false, message: "Không lấy được chiến dịch" });
  }
});

/* ========================= GET /api/campaigns/:id/donations ========================= */
router.get("/:id/donations", async (req, res) => {
  try {
    const id = req.params.id;
    const items = await dbAll(
      `
      SELECT id, type, amount, qty, currency, donor_name, donor_note, memo, status, paid_at, created_at
      FROM donations
      WHERE campaign_id=? AND status='success'
      ORDER BY COALESCE(paid_at, created_at) DESC, id DESC
      LIMIT 500
      `,
      [id]
    ).catch(() => []);
    const safe = items.map((it) => ({
      id: it.id,
      type: it.type,
      amount: toNum(it.amount, 0),
      qty: toNum(it.qty, 0),
      currency: it.currency || "VND",
      donor_name: it.donor_name || "Ẩn danh",
      donor_note: it.donor_note || "",
      paid_at: it.paid_at || it.created_at,
    }));
    res.json({ ok: true, items: safe });
  } catch (err) {
    console.error("[GET /api/campaigns/:id/donations] error:", err);
    res.status(500).json({ ok: false, message: "Không lấy được danh sách ủng hộ" });
  }
});

/* ========================= GET /api/campaigns/:id/reports ========================= */
router.get("/:id/reports", async (req, res) => {
  try {
    const id = req.params.id;

    const campaign = await dbGet(
      `
      SELECT
        c.id, c.title, c.description, c.location, c.goal,
        c.cover, c.tags, c.status, c.created_at, c.updated_at, c.deadline,
        ${AGG.raisedCol}    AS raised_calc,
        ${AGG.supportersCol} AS supporters_calc
      FROM campaigns c
      WHERE c.id=?
      `,
      [id]
    );
    if (!campaign)
      return res.status(404).json({ ok: false, message: "Không tìm thấy chiến dịch" });

    const donationsByMonth = await dbAll(
      `
      SELECT ${AGG.monthExpr} AS month, SUM(amount) AS total
      FROM donations
      WHERE campaign_id=? AND status='success'
      GROUP BY month
      ORDER BY month ASC
      `,
      [id]
    );

    res.json({
      ok: true,
      campaign: mapCampaignRow(campaign),
      donationsByMonth: donationsByMonth.map((d) => ({
        month: d.month,
        total: toNum(d.total, 0),
      })),
    });
  } catch (err) {
    console.error("[GET /api/campaigns/:id/reports] error:", err);
    res.status(500).json({ ok: false, message: "Không lấy được báo cáo" });
  }
});

export default router;
