// backend/src/routes/overview.js
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

/* ========================= Common helpers ========================= */
function sendError(res, status, code, message, details) {
  if (details) console.warn(`[${code}]`, details?.stack || details?.message || details);
  const payload = { ok: false, code, message };
  if (process.env.NODE_ENV !== "production" && details) payload.debug = String(details?.message || details);
  return res.status(status).json(payload);
}
const toNum = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
function parseJson(raw, fb = {}) {
  try {
    if (raw == null || raw === "") return fb;
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch { return fb; }
}
function normalizeTags(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // cho phép CSV fallback
    return String(raw)
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
  }
}
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const toInt = (v, d = 0, min = -Infinity, max = Infinity) =>
  Number.isFinite(parseInt(v, 10)) ? clamp(parseInt(v, 10), min, max) : d;
const toFloat = (v, d = 0) => (Number.isFinite(parseFloat(v)) ? parseFloat(v) : d);

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

/* ========================= Aggregation expr (MySQL/SQLite) ========================= */
const AGG = {
  raisedCol: `(SELECT COALESCE(SUM(d.amount),0) FROM donations d WHERE d.campaign_id=c.id AND d.status='success')`,
  supportersCol: `(SELECT COUNT(*) FROM donations d WHERE d.campaign_id=c.id AND d.status='success')`,
  // date expr dùng ở nơi khác nếu cần
  nowExpr: useMySQL ? `CURRENT_TIMESTAMP()` : `DATETIME('now')`,
  todayExpr: useMySQL ? `CURRENT_DATE()` : `DATE('now')`,
};

/* ========================= Site settings helpers ========================= */
async function getSiteSetting(key) {
  try {
    const row = await dbGet(
      `SELECT value FROM site_settings WHERE \`key\`=? LIMIT 1`,
      [key]
    );
    if (!row) return null;
    const raw = row.value;
    // value có thể là số, string JSON, v.v…
    try {
      const asNum = Number(raw);
      if (Number.isFinite(asNum)) return asNum;
    } catch {}
    try { return JSON.parse(raw); } catch {}
    return raw;
  } catch { return null; }
}

async function getDefaultMealPrice() {
  const v = await getSiteSetting("meal_price_vnd");
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 10000; // fallback 10k
}

/* ========================= Cache overview (60s) ========================= */
let OVERVIEW_CACHE = { data: null, at: 0 };
const OVERVIEW_TTL_MS = 60 * 1000;

/* ========================= Normalizers ========================= */
function mapCampaignRow(r, opts) {
  const meta = parseJson(r.tags, {});
  const goal = toNum(r.goal ?? r.target_amount, 0);
  const raised = toNum(r.raised_calc ?? r.raised, 0);
  const supporters = toNum(r.supporters_calc ?? r.supporters, 0);
  const mealMeta = meta?.meal || {};
  const campaignMealPrice = toNum(mealMeta.price_vnd ?? mealMeta.price ?? 0, 0);
  const price = campaignMealPrice > 0 ? campaignMealPrice : (opts?.defaultMealPrice ?? 10000);
  const impact_meals = Math.floor(raised / (price || 10000));
  return {
    id: r.id,
    title: r.title || "",
    description: r.description || "",
    cover: r.cover || r.cover_url || "",
    location: r.location || "",
    deadline: r.deadline || meta?.end_at || null,
    goal,
    raised,
    supporters,
    impact_meals,
    tags: normalizeTags(r.tags),
  };
}

/* ========================= Build overview payload ========================= */
async function buildOverviewPayload() {
  // counts
  const qUsers = `SELECT COUNT(*) AS c FROM users`;
  const qDonors = `SELECT COUNT(*) AS c FROM users WHERE role='donor'`;
  const qRecipients = `SELECT COUNT(*) AS c FROM users WHERE role='receiver'`;
  const qCampaigns = `SELECT COUNT(*) AS c FROM campaigns`;
  const qActive = useMySQL
    ? `SELECT COUNT(*) AS c FROM campaigns WHERE (status='active' OR status IS NULL) AND (deadline IS NULL OR deadline>=${AGG.todayExpr})`
    : `SELECT COUNT(*) AS c FROM campaigns WHERE (status='active' OR status IS NULL) AND (deadline IS NULL OR DATE(deadline)>=${AGG.todayExpr})`;

  const [usersRow, donorsRow, recipientsRow, campaignsRow, activeRow] = await Promise.all([
    dbGet(qUsers).catch(() => ({ c: 0 })),
    dbGet(qDonors).catch(() => ({ c: 0 })),
    dbGet(qRecipients).catch(() => ({ c: 0 })),
    dbGet(qCampaigns).catch(() => ({ c: 0 })),
    dbGet(qActive).catch(() => ({ c: 0 })),
  ]);

  // raised tổng từ donations success
  const raisedRow = await dbGet(
    `SELECT COALESCE(SUM(amount),0) AS raised FROM donations WHERE status='success'`
  ).catch(() => ({ raised: 0 }));
  const totalRaised = toNum(raisedRow?.raised, 0);

  // supporters tổng (đếm donations success)
  const supportersRow = await dbGet(
    `SELECT COUNT(*) AS supporters FROM donations WHERE status='success'`
  ).catch(() => ({ supporters: 0 }));
  const supporters = toNum(supportersRow?.supporters, 0);

  // meals_given = tổng tiền đã raise / meal_price_vnd (site-wide)
  const defaultMealPrice = await getDefaultMealPrice();
  const meals_given = Math.floor(totalRaised / (defaultMealPrice || 10000));

  return {
    ok: true,
    users: toNum(usersRow?.c, 0),
    donors: toNum(donorsRow?.c, 0),
    recipients: toNum(recipientsRow?.c, 0),
    campaigns: toNum(campaignsRow?.c, 0),
    active_campaigns: toNum(activeRow?.c, 0),
    raised: totalRaised,
    supporters,
    meals_given,
    meal_price_vnd: defaultMealPrice,
    updated_at: new Date().toISOString(),
  };
}

/* ========================= Routes: /api/overview (+ alias "/") ========================= */
router.get("/", async (_req, res) => {
  try {
    if (OVERVIEW_CACHE.data && Date.now() - OVERVIEW_CACHE.at < OVERVIEW_TTL_MS) {
      return res.json(OVERVIEW_CACHE.data);
    }
    const payload = await buildOverviewPayload();
    OVERVIEW_CACHE = { data: payload, at: Date.now() };
    return res.json(payload);
  } catch (err) {
    return sendError(res, 500, "overview_failed", "Không lấy được số liệu tổng quan.", err);
  }
});

router.get("/overview", async (_req, res) => {
  try {
    if (OVERVIEW_CACHE.data && Date.now() - OVERVIEW_CACHE.at < OVERVIEW_TTL_MS) {
      return res.json(OVERVIEW_CACHE.data);
    }
    const payload = await buildOverviewPayload();
    OVERVIEW_CACHE = { data: payload, at: Date.now() };
    return res.json(payload);
  } catch (err) {
    return sendError(res, 500, "overview_failed", "Không lấy được số liệu tổng quan.", err);
  }
});

/* ========================= Campaigns (featured + paging, synced) =========================
   GET /api/campaigns?featured=1&page=1&pageSize=6
   Trả về: { id, title, description, cover, location, deadline, goal, raised, supporters, impact_meals, tags[] }
================================================================= */
router.get("/campaigns", async (req, res) => {
  try {
    const featured = String(req.query.featured || "") === "1";
    const page = toInt(req.query.page, 1, 1, 1e6);
    const pageSize = toInt(req.query.pageSize, featured ? 6 : 8, 1, 50);
    const offset = (page - 1) * pageSize;

    const whereSQL = featured ? `WHERE c.featured=1` : ``;

    const listSQL = `
      SELECT
        c.id, c.title, c.description, c.location, c.goal, c.cover, c.tags, c.deadline,
        ${AGG.raisedCol}     AS raised_calc,
        ${AGG.supportersCol} AS supporters_calc
      FROM campaigns c
      ${whereSQL}
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const countSQL = `SELECT COUNT(*) AS total FROM campaigns c ${whereSQL}`;

    const [rows, totalRow, defaultMealPrice] = await Promise.all([
      dbAll(listSQL, [pageSize, offset]),
      dbGet(countSQL, []),
      getDefaultMealPrice(),
    ]);

    const items = rows.map((r) => {
      // ép JSON → object để map được price_vnd nếu có
      const meta = parseJson(r.tags, {});
      const withMeta = { ...r, tags: JSON.stringify(meta) };
      return mapCampaignRow(withMeta, { defaultMealPrice });
    });

    return res.json({
      ok: true,
      items,
      total: toNum(totalRow?.total, 0),
      page,
      pageSize,
    });
  } catch (err) {
    return sendError(res, 500, "campaigns_failed", "Không lấy được danh sách chiến dịch.", err);
  }
});

/* ========================= Recommendation foods (giữ nguyên giao diện) =========================
   GET /api/reco/foods?lat=&lng=&maxKm=5&diet=any|chay|halal|kythit|none&sort=priority|expireSoon|dietMatch|distance&limit=9
   Yêu cầu bảng food_items có các cột liên quan
================================================================= */
function toRad(x) { return (x * Math.PI) / 180; }
function haversineKm(a, b) {
  const R = 6371;
  const dLat = toRad((b.lat ?? 0) - (a.lat ?? 0));
  const dLng = toRad((b.lng ?? 0) - (a.lng ?? 0));
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat ?? 0)) * Math.cos(toRad(b.lat ?? 0)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}
function parseArrayMaybeCsv(val) {
  if (Array.isArray(val)) return val;
  if (val == null) return [];
  const s = String(val).trim();
  if (!s) return [];
  if (s.startsWith("[") || s.startsWith("{")) {
    try { const j = JSON.parse(s); return Array.isArray(j) ? j : []; } catch { return []; }
  }
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}

router.get("/reco/foods", async (req, res) => {
  try {
    const lat = toFloat(req.query.lat, NaN);
    const lng = toFloat(req.query.lng, NaN);
    const hasCenter = Number.isFinite(lat) && Number.isFinite(lng);
    const maxKm = toInt(req.query.maxKm, 5, 1, 50);
    const diet = String(req.query.diet || "any").toLowerCase();
    const sort = String(req.query.sort || "priority").toLowerCase();
    const limit = toInt(req.query.limit, 9, 1, 24);

    const rows = await dbAll(
      useMySQL
        ? `SELECT id, title, description, images, qty, unit, tags, expire_at,
                  COALESCE(lat, location_lat) AS lat,
                  COALESCE(lng, location_lng) AS lng,
                  location_addr, updated_at
           FROM food_items
           WHERE (expire_at IS NULL OR expire_at >= ${AGG.nowExpr})
             AND COALESCE(qty,0) > 0
           ORDER BY updated_at DESC
           LIMIT 400`
        : `SELECT id, title, description, images, qty, unit, tags, expire_at,
                  COALESCE(lat, location_lat) AS lat,
                  COALESCE(lng, location_lng) AS lng,
                  location_addr, updated_at
           FROM food_items
           WHERE (expire_at IS NULL OR DATETIME(expire_at) >= ${AGG.nowExpr})
             AND COALESCE(qty,0) > 0
           ORDER BY updated_at DESC
           LIMIT 400`
    );

    const items = rows.map((it) => {
      const tags = parseArrayMaybeCsv(it.tags).map((t) => String(t));
      const images = parseArrayMaybeCsv(it.images);
      let distance_km = null;
      if (hasCenter && Number.isFinite(it.lat) && Number.isFinite(it.lng)) {
        distance_km = haversineKm({ lat, lng }, { lat: Number(it.lat), lng: Number(it.lng) });
      }
      return { ...it, tags, images, distance_km: Number.isFinite(distance_km) ? distance_km : null };
    });

    let filtered = items;
    if (hasCenter) filtered = filtered.filter((it) => it.distance_km == null || it.distance_km <= maxKm);

    if (diet !== "any" && diet !== "none") {
      filtered = filtered.filter((it) => {
        const tags = (it.tags || []).map((t) => String(t).toLowerCase());
        if (diet === "chay") return tags.includes("chay") || tags.includes("vegetarian") || tags.includes("vegan");
        if (diet === "halal") return tags.includes("halal");
        if (diet === "kythit") return !tags.includes("thit") && !tags.includes("meat");
        return true;
      });
    }

    const now = Date.now();
    const scored = filtered.map((it) => {
      let expiryScore = 0;
      if (it.expire_at) {
        const diffH = (new Date(it.expire_at).getTime() - now) / 3600000;
        expiryScore = diffH <= 0 ? 1 : 1 / Math.log10(2 + diffH);
      }
      const dist = it.distance_km;
      const distanceScore = Number.isFinite(dist) ? 1 / (1 + dist) : 0.6;
      const tagsLc = (it.tags || []).map((t) => String(t).toLowerCase());
      const dietMatch =
        (diet === "chay" && (tagsLc.includes("chay") || tagsLc.includes("vegetarian") || tagsLc.includes("vegan"))) ||
        (diet === "halal" && tagsLc.includes("halal")) ||
        (diet === "kythit" && !tagsLc.includes("thit") && !tagsLc.includes("meat"));
      const priority = 0.45 * distanceScore + 0.4 * expiryScore + 0.15 * (dietMatch ? 1 : 0);
      return { ...it, diet_match: !!dietMatch, reco_score: priority };
    });

    if (sort === "expiresoon") {
      scored.sort((a, b) => {
        const ta = a.expire_at ? new Date(a.expire_at).getTime() : Infinity;
        const tb = b.expire_at ? new Date(b.expire_at).getTime() : Infinity;
        return ta - tb;
      });
    } else if (sort === "dietmatch") {
      scored.sort((a, b) => Number(b.diet_match) - Number(a.diet_match));
    } else if (sort === "distance") {
      scored.sort((a, b) => (a.distance_km ?? 1e9) - (b.distance_km ?? 1e9));
    } else {
      scored.sort((a, b) => (b.reco_score || 0) - (a.reco_score || 0));
    }

    return res.json(scored.slice(0, limit));
  } catch (err) {
    return sendError(res, 500, "reco_foods_failed", "Không lấy được gợi ý món ăn.", err);
  }
});

/* ========================= Pickup suggestion =========================
   GET /api/reco/pickup?lat=&lng=
================================================================= */
router.get("/reco/pickup", async (req, res) => {
  try {
    const lat = toFloat(req.query.lat, NaN);
    const lng = toFloat(req.query.lng, NaN);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return sendError(res, 422, "pickup_need_location", "Chưa có vị trí để gợi ý khung giờ/điểm hẹn.");
    }

    let hubs = [];
    try {
      hubs = await dbAll(
        `SELECT id, name, COALESCE(lat, location_lat) AS lat, COALESCE(lng, location_lng) AS lng
         FROM pickup_points
         LIMIT 200`
      );
      hubs = hubs
        .map((h) => ({
          ...h,
          distance_km:
            Number.isFinite(h?.lat) && Number.isFinite(h?.lng)
              ? haversineKm({ lat, lng }, { lat: Number(h.lat), lng: Number(h.lng) })
              : null,
        }))
        .sort((a, b) => (a.distance_km ?? 1e9) - (b.distance_km ?? 1e9))
        .slice(0, 5);
    } catch {
      hubs = [];
    }

    const windows = ["11:30–12:30", "12:30–13:30", "17:30–18:30", "18:30–19:30"];
    return res.json({ ok: true, windows, hubs });
  } catch (err) {
    return sendError(res, 500, "reco_pickup_failed", "Không lấy được gợi ý khung giờ/điểm hẹn.", err);
  }
});

export default router;
