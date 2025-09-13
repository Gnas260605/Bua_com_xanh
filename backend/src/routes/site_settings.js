// backend/src/routes/site_settings.js
import { Router } from "express";
import "dotenv/config";

const useMySQL = (process.env.DB_DRIVER || "sqlite") === "mysql";
let db;
if (useMySQL) ({ db } = await import("../lib/db.mysql.js"));
else ({ db } = await import("../lib/db.js"));

const router = Router();

/* ========================= DB helpers ========================= */
async function dbGet(sql, params = []) {
  if (useMySQL) {
    if (typeof db.get === "function") return await db.get(sql, params);
    const [rows] = await db.query(sql, params);
    return rows?.[0] ?? null;
  }
  return db.prepare(sql).get(...params);
}
async function dbAll(sql, params = []) {
  if (useMySQL) {
    if (typeof db.all === "function") return await db.all(sql, params);
    const [rows] = await db.query(sql, params);
    return rows ?? [];
  }
  return db.prepare(sql).all(...params);
}

/* ========================= Utils ========================= */
function parseJson(raw, fallback) {
  try {
    if (raw == null || raw === "") return fallback;
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return fallback;
  }
}
const toNum = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

/** Read setting from site_settings using either (k,v) or (s_key,s_value) schema */
async function readSetting(key) {
  // k/v
  let row = await dbGet(`SELECT v AS value FROM site_settings WHERE k=? LIMIT 1`, [key]).catch(
    () => null
  );
  if (row?.value != null) return row.value;

  // s_key/s_value
  row = await dbGet(
    `SELECT s_value AS value FROM site_settings WHERE s_key=? LIMIT 1`,
    [key]
  ).catch(() => null);
  return row?.value ?? null;
}

/* ============================================================================
   GET /api/site-settings?key=...
   - key=meal_fee_vnd: number (default 2000)
   - key=pickup_points: real points from pickup_points table (active, limit)
   - key=payment_gateways: from site_settings; fallback mock list (enabled only)
   - others: raw value from site_settings (auto JSON parse)
============================================================================ */
router.get("/", async (req, res) => {
  try {
    const key = String(req.query.key || "").trim();
    if (!key) return res.json({ ok: true, items: [] });

    /* ---- pickup_points: read REAL data from table ---- */
    if (key === "pickup_points") {
      const onlyActive = String(req.query.active || "").trim() === "1";
      const limit = Math.max(1, Math.min(500, Number(req.query.limit || 200)));

      let rows = [];
      try {
        const where = [];
        if (onlyActive) where.push(`status='active'`);
        const whereSQL = where.length ? `WHERE ${where.join(" AND ")}` : "";

        // use * to tolerate column name differences (open_hours/opening/hours, latitude/longitude)
        rows = await dbAll(
          `SELECT * FROM pickup_points ${whereSQL} ORDER BY id DESC LIMIT ?`,
          [limit]
        );
      } catch {
        rows = [];
      }

      const items = rows.map((p) => ({
        id: p.id,
        name: p.name || "Điểm nhận",
        address: p.address || "",
        lat: Number(p.lat ?? p.latitude),
        lng: Number(p.lng ?? p.longitude),
        open_hours: p.open_hours ?? p.opening ?? p.hours ?? "",
        status: p.status || "active",
      }));
      return res.json({ ok: true, items });
    }

    /* ---- meal_fee_vnd: numeric with sensible default ---- */
    if (key === "meal_fee_vnd") {
      const raw = await readSetting(key);
      const fee = toNum(parseJson(raw, raw), 0);
      return res.json({ ok: true, key, value: fee > 0 ? fee : 2000 });
    }

    /* ---- payment_gateways: from settings or fallback mock so FE still works ---- */
    if (key === "payment_gateways") {
      const raw = await readSetting(key);
      let list = parseJson(raw, null);
      if (!Array.isArray(list)) {
        list = [
          { code: "MOMO", name: "MoMo (Sandbox)", enabled: true },
          { code: "VNPAY", name: "VNPAY (Sandbox)", enabled: true },
          { code: "ZALOPAY", name: "ZaloPay (Sandbox)", enabled: true },
          { code: "STRIPE", name: "Stripe (Test)", enabled: true },
        ];
      }
      list = list
        .map((x) => (typeof x === "string" ? { code: x, name: x, enabled: true } : x))
        .filter((x) => x && (x.enabled === undefined || x.enabled));
      return res.json({ ok: true, key, value: list });
    }

    /* ---- other keys: return stored value (auto JSON parse) ---- */
    const raw = await readSetting(key);
    const value = parseJson(raw, raw ?? null);
    return res.json({ ok: true, key, value });
  } catch (e) {
    console.error("[GET /api/site-settings] ", e);
    return res.status(200).json({ ok: false, message: "error", value: null });
  }
});

export default router;
