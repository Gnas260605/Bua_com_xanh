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

/* =========================
   Helpers chung
========================= */
function sendError(res, status, code, message, details = undefined) {
  if (details) console.warn(`[${code}]`, details?.stack || details?.message || details);
  const payload = { ok: false, code, message };
  if (process.env.NODE_ENV !== "production" && details) {
    payload.debug = String(details?.message || details);
  }
  return res.status(status).json(payload);
}
function nowISO() { return new Date().toISOString(); }

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
    throw new Error(`dbGet failed: ${(e && e.message) || e}`);
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
    throw new Error(`dbAll failed: ${(e && e.message) || e}`);
  }
}

// Thử lần lượt các câu query (fallback khác schema)
async function tryFirst(variants) {
  for (const { sql, params = [] } of variants) {
    try {
      const row = await dbGet(sql, params);
      if (row && Object.keys(row).length) return row;
    } catch { /* ignore & try next */ }
  }
  return null;
}

// Parse số an toàn
function toInt(v, def, min = -Infinity, max = Infinity) {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
}
function toFloat(v, def) {
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : def;
}

// Haversine
function toRad(x) { return (x * Math.PI) / 180; }
function haversineKm(a, b) {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

// Parse JSON an toàn (mảng), fallback []
function safeParseArrayMaybeCsv(val) {
  if (Array.isArray(val)) return val;
  if (typeof val !== "string") return [];
  const s = val.trim();
  if (!s) return [];
  if (s.startsWith("[") || s.startsWith("{")) {
    try {
      const j = JSON.parse(s);
      return Array.isArray(j) ? j : [];
    } catch { return []; }
  }
  // CSV -> array
  return s.split(",").map(x => x.trim()).filter(Boolean);
}

/* =========================
   In-memory cache cho overview (60s)
========================= */
let OVERVIEW_CACHE = { data: null, at: 0 };
const OVERVIEW_TTL_MS = 60 * 1000;

/* =========================
   Build overview payload
========================= */
async function buildOverviewPayload() {
  const qUsers = "SELECT COUNT(*) AS c FROM users";
  const qDonors = "SELECT COUNT(*) AS c FROM users WHERE role='donor'";
  const qRecipients = "SELECT COUNT(*) AS c FROM users WHERE role='receiver'";
  const qShippers = "SELECT COUNT(*) AS c FROM users WHERE role='shipper'";
  const qCampaigns = "SELECT COUNT(*) AS c FROM campaigns";
  const qActiveCampaigns = useMySQL
    ? `SELECT COUNT(*) AS c
       FROM campaigns
       WHERE (status='active' OR status IS NULL)
         AND (deadline IS NULL OR deadline >= CURRENT_DATE())`
    : `SELECT COUNT(*) AS c
       FROM campaigns
       WHERE (status='active' OR status IS NULL)
         AND (deadline IS NULL OR DATE(deadline) >= DATE('now'))`;

  const [a, b, c, d, e, f] = await Promise.all([
    dbGet(qUsers),
    dbGet(qDonors),
    dbGet(qRecipients),
    dbGet(qShippers),
    dbGet(qCampaigns),
    dbGet(qActiveCampaigns),
  ]);

  // meals_given: ưu tiên deliveries, fallback bookings
  let mealsGiven = 0;
  const delivered = await tryFirst([
    { sql: "SELECT COALESCE(SUM(qty),0) AS s FROM deliveries WHERE status='delivered'" },
    { sql: "SELECT COALESCE(SUM(quantity),0) AS s FROM deliveries WHERE status='delivered'" },
    { sql: "SELECT COALESCE(SUM(qty),0) AS s FROM deliveries WHERE delivered=1" },
    { sql: "SELECT COALESCE(SUM(quantity),0) AS s FROM deliveries WHERE delivered=1" },
  ]);
  if (delivered?.s != null) {
    mealsGiven = Number(delivered.s) || 0;
  } else {
    const completed = await tryFirst([
      { sql: "SELECT COALESCE(SUM(qty),0) AS s FROM bookings WHERE status IN ('completed','received','done')" },
      { sql: "SELECT COALESCE(SUM(quantity),0) AS s FROM bookings WHERE status IN ('completed','received','done')" },
    ]);
    mealsGiven = Number(completed?.s || 0);
  }

  return {
    meals_given: mealsGiven,
    donors: Number(b?.c || 0),
    recipients: Number(c?.c || 0),
    shippers: Number(d?.c || 0),
    campaigns: Number(e?.c || 0),
    active_campaigns: Number(f?.c || 0),
    users: Number(a?.c || 0), // optional
    updated_at: nowISO(),
  };
}

/* =========================
   Routes: /api (alias) và /api/overview
========================= */
router.get("/", async (_req, res) => {
  try {
    if (OVERVIEW_CACHE.data && Date.now() - OVERVIEW_CACHE.at < OVERVIEW_TTL_MS) {
      return res.json(OVERVIEW_CACHE.data);
    }
    const payload = await buildOverviewPayload();
    OVERVIEW_CACHE = { data: payload, at: Date.now() };
    res.json(payload);
  } catch (err) {
    console.error("[/api] overview error:", err);
    return sendError(res, 500, "overview_failed", "Không lấy được số liệu tổng quan. Vui lòng thử lại sau.", err);
  }
});

router.get("/overview", async (_req, res) => {
  try {
    if (OVERVIEW_CACHE.data && Date.now() - OVERVIEW_CACHE.at < OVERVIEW_TTL_MS) {
      return res.json(OVERVIEW_CACHE.data);
    }
    const payload = await buildOverviewPayload();
    OVERVIEW_CACHE = { data: payload, at: Date.now() };
    res.json(payload);
  } catch (err) {
    console.error("[/api/overview] error:", err);
    return sendError(res, 500, "overview_failed", "Không lấy được số liệu tổng quan. Vui lòng thử lại sau.", err);
  }
});

/* =========================
   Campaigns (featured + pagination)
   GET /api/campaigns?featured=1&page=1&pageSize=6
========================= */
router.get("/campaigns", async (req, res) => {
  try {
    const featured = req.query.featured === "1";
    const page = toInt(req.query.page, 1, 1, 1e6);
    const pageSize = toInt(req.query.pageSize, 6, 1, 50);
    const offset = (page - 1) * pageSize;

    const where = featured ? "WHERE featured=1" : "";
    const orderBy = "ORDER BY created_at DESC";

    const items = await dbAll(
      `SELECT id, title, description, cover, location, deadline, goal, raised, impact_meals, tags
       FROM campaigns
       ${where} ${orderBy}
       LIMIT ? OFFSET ?`,
      [pageSize, offset]
    );

    const totRow = await dbGet(`SELECT COUNT(*) AS c FROM campaigns ${where}`);
    for (const it of items) {
      it.tags = safeParseArrayMaybeCsv(it.tags);
    }

    return res.json({ ok: true, items, total: Number(totRow?.c || 0), page, pageSize });
  } catch (err) {
    console.error("[/api/campaigns] error:", err);
    return sendError(res, 500, "campaigns_failed", "Không lấy được danh sách chiến dịch.", err);
  }
});

/* =========================
   Recommendation (user-only) – baseline ổn định
   GET /api/reco/foods?lat=&lng=&maxKm=5&diet=any|chay|halal|kythit|none&sort=priority|expireSoon|dietMatch|distance&limit=9
   Yêu cầu bảng food_items có: lat/lng (hoặc location_lat/location_lng), expire_at, qty, unit, tags
========================= */
router.get("/reco/foods", async (req, res) => {
  try {
    const lat = toFloat(req.query.lat, NaN);
    const lng = toFloat(req.query.lng, NaN);
    const hasCenter = Number.isFinite(lat) && Number.isFinite(lng);
    const maxKm = toInt(req.query.maxKm, 5, 1, 20);
    const diet = String(req.query.diet || "any").toLowerCase();
    const sort = String(req.query.sort || "priority").toLowerCase();
    const limit = toInt(req.query.limit, 9, 1, 24);

    // Lấy món còn hạn & còn qty>0
    const sql = useMySQL
      ? `SELECT id, title, description, images, qty, unit, tags, expire_at,
                COALESCE(lat, location_lat) AS lat,
                COALESCE(lng, location_lng) AS lng,
                location_addr, updated_at
         FROM food_items
         WHERE (expire_at IS NULL OR expire_at >= CURRENT_TIMESTAMP())
           AND COALESCE(qty,0) > 0
         ORDER BY updated_at DESC
         LIMIT 400`
      : `SELECT id, title, description, images, qty, unit, tags, expire_at,
                COALESCE(lat, location_lat) AS lat,
                COALESCE(lng, location_lng) AS lng,
                location_addr, updated_at
         FROM food_items
         WHERE (expire_at IS NULL OR DATETIME(expire_at) >= DATETIME('now'))
           AND COALESCE(qty,0) > 0
         ORDER BY updated_at DESC
         LIMIT 400`;

    const rows = await dbAll(sql);

    // Chuẩn hoá + tính khoảng cách
    const items = rows.map((it) => {
      const tags = safeParseArrayMaybeCsv(it.tags).map(t => String(t));
      let images = it.images;
      if (!Array.isArray(images)) {
        images = safeParseArrayMaybeCsv(images);
      }
      let distance_km = null;
      if (hasCenter && Number.isFinite(it.lat) && Number.isFinite(it.lng)) {
        distance_km = haversineKm({ lat, lng }, { lat: Number(it.lat), lng: Number(it.lng) });
      }
      return {
        ...it,
        tags,
        images,
        distance_km: Number.isFinite(distance_km) ? distance_km : null,
      };
    });

    // Filter theo bán kính (nếu có vị trí)
    let filtered = items;
    if (hasCenter) filtered = filtered.filter(it => it.distance_km === null || it.distance_km <= maxKm);

    // Filter chế độ ăn
    if (diet !== "any" && diet !== "none") {
      filtered = filtered.filter(it => {
        const tags = (it.tags || []).map(t => String(t).toLowerCase());
        if (diet === "chay")   return tags.includes("chay") || tags.includes("vegetarian") || tags.includes("vegan");
        if (diet === "halal")  return tags.includes("halal");
        if (diet === "kythit") return !tags.includes("thit") && !tags.includes("meat");
        return true;
      });
    }

    // Tính điểm ưu tiên
    const now = Date.now();
    const scored = filtered.map((it) => {
      let expiryScore = 0;
      if (it.expire_at) {
        const diffH = (new Date(it.expire_at).getTime() - now) / (1000 * 60 * 60);
        expiryScore = diffH <= 0 ? 1 : 1 / Math.log10(2 + diffH);
      }
      const dist = it.distance_km;
      const distanceScore = Number.isFinite(dist) ? 1 / (1 + dist) : 0.6;

      const tagsLc = (it.tags || []).map(t => String(t).toLowerCase());
      const dietMatch =
        (diet === "chay"   && (tagsLc.includes("chay") || tagsLc.includes("vegetarian") || tagsLc.includes("vegan"))) ||
        (diet === "halal"  && tagsLc.includes("halal")) ||
        (diet === "kythit" && !tagsLc.includes("thit") && !tagsLc.includes("meat"));

      const priority = 0.45 * distanceScore + 0.4 * expiryScore + 0.15 * (dietMatch ? 1 : 0);
      return { ...it, diet_match: !!dietMatch, reco_score: priority };
    });

    // Sort
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
      scored.sort((a, b) => (b.reco_score || 0) - (a.reco_score || 0)); // priority
    }

    // FE đang map thẳng mảng items
    return res.json(scored.slice(0, limit));
  } catch (err) {
    console.error("[/api/reco/foods] error:", err);
    return sendError(res, 500, "reco_foods_failed", "Không lấy được danh sách gợi ý món ăn.", err);
  }
});

/* =========================
   Pickup suggestion (user-only)
   GET /api/reco/pickup?lat=&lng=
========================= */
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
        `SELECT id, name,
                COALESCE(lat, location_lat) AS lat,
                COALESCE(lng, location_lng) AS lng
         FROM pickup_points
         LIMIT 200`
      );
      hubs = hubs
        .map(h => ({
          ...h,
          distance_km: (Number.isFinite(h.lat) && Number.isFinite(h.lng))
            ? haversineKm({ lat, lng }, { lat: Number(h.lat), lng: Number(h.lng) })
            : null
        }))
        .sort((a,b) => (a.distance_km ?? 1e9) - (b.distance_km ?? 1e9))
        .slice(0, 5);
    } catch (e) {
      console.warn("[/api/reco/pickup] pickup_points query failed:", e?.message || e);
      hubs = [];
    }

    const windows = ["11:30–12:30", "12:30–13:30", "17:30–18:30", "18:30–19:30"];
    return res.json({ ok: true, windows, hubs });
  } catch (err) {
    console.error("[/api/reco/pickup] error:", err);
    return sendError(res, 500, "reco_pickup_failed", "Không lấy được gợi ý khung giờ/điểm hẹn.", err);
  }
});

export default router;
