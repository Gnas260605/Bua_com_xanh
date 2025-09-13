// backend/src/routes/payments.js
import { Router } from "express";
import "dotenv/config";
import { momoCreatePayment, momoVerifyIPN } from "../lib/pay.momo.js";

const useMySQL = (process.env.DB_DRIVER || "sqlite") === "mysql";
let db;
if (useMySQL) ({ db } = await import("../lib/db.mysql.js"));
else ({ db } = await import("../lib/db.js"));

const router = Router();

/* ========================= DB helpers ========================= */
async function dbAll(sql, params = []) {
  if (useMySQL) {
    if (typeof db.all === "function") return await db.all(sql, params);
    const [rows] = await db.query(sql, params);
    return rows ?? [];
  }
  return db.prepare(sql).all(...params);
}
async function dbGet(sql, params = []) {
  if (useMySQL) {
    if (typeof db.get === "function") return await db.get(sql, params);
    const [rows] = await db.query(sql, params);
    return rows?.[0] ?? null;
  }
  return db.prepare(sql).get(...params);
}
async function dbRun(sql, params = []) {
  if (useMySQL) {
    const [ret] = await db.query(sql, params);
    return ret;
  }
  return db.prepare(sql).run(...params);
}

/* ========================= Utils ========================= */
const toNum = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const nowSQL = () => new Date().toISOString().slice(0, 19).replace("T", " ");
function parseJson(raw, fallback) {
  try {
    if (raw == null || raw === "") return fallback;
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return fallback;
  }
}

/** Đọc setting từ site_settings, hỗ trợ cả 2 schema: k/v và s_key/s_value */
async function getSetting(key) {
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

/* ========================= GET /api/payments/gateways ======================= */
/** Đọc từ site_settings('payment_gateways'); nếu trống → danh sách mẫu */
router.get("/gateways", async (_req, res) => {
  try {
    const raw = await getSetting("payment_gateways");
    let gws = parseJson(raw, null);

    if (!Array.isArray(gws)) {
      gws = [{ code: "MOMO", name: "MoMo (Sandbox)", enabled: true }];
    }

    // Chuẩn hóa + lọc enabled
    gws = gws
      .map((x) => (typeof x === "string" ? { code: x, name: x, enabled: true } : x))
      .filter((x) => x && (x.enabled === undefined || x.enabled));

    res.json(gws);
  } catch {
    res.json([{ code: "MOMO", name: "MoMo (Sandbox)", enabled: true }]);
  }
});

/* ========================= POST /api/payments/create ======================== */
/**
 * Body: { campaign_id, amount, method }
 * - Nếu method=MOMO & đủ ENV & không mock → gọi MoMo thật, trả pay_url
 * - Ngược lại → trả QR mock (svg) để FE test ngay
 */
router.post("/create", async (req, res) => {
  try {
    const campaign_id = req.body?.campaign_id;
    const amount = toNum(req.body?.amount, 0);
    const method = String(req.body?.method || "MOMO").toUpperCase();

    if (!campaign_id || amount <= 0) {
      return res.status(400).json({ ok: false, message: "campaign_id/amount không hợp lệ" });
    }

    // Ghi order pending (nếu có bảng payments)
    const orderId = `${method}-${campaign_id}-${Date.now()}`;
    await dbRun(
      `INSERT INTO payments (campaign_id, amount, method, status, created_at)
       VALUES (?, ?, ?, 'pending', ?)`,
      [campaign_id, amount, method, nowSQL()]
    ).catch(() => null);

    // Điều kiện gọi MoMo thật
    const hasMomoEnv =
      !!process.env.MOMO_PARTNER_CODE &&
      !!process.env.MOMO_ACCESS_KEY &&
      !!process.env.MOMO_SECRET_KEY;

    // Không dùng các public demo keys để tránh lỗi
    const isPublicDemoKeys =
      process.env.MOMO_PARTNER_CODE === "MOMOBKUN20180529" &&
      process.env.MOMO_ACCESS_KEY === "klm05TvNBzhg7h7j" &&
      process.env.MOMO_SECRET_KEY === "at67qH6mk8w5Y1nAyMoYKMWACiEi2bsa";

    // Callback local thì nhiều khi sandbox từ MoMo không gọi được → mock
    const isLocalCallback =
      (process.env.MOMO_IPN_URL || "").includes("localhost") ||
      (process.env.MOMO_IPN_URL || "").includes("127.0.0.1") ||
      (process.env.PAY_RETURN_URL || "").includes("localhost") ||
      (process.env.PAY_RETURN_URL || "").includes("127.0.0.1");

    const shouldMock =
      process.env.PAYMENTS_FORCE_MOCK === "1" || !hasMomoEnv || isPublicDemoKeys || isLocalCallback;

    if (method === "MOMO" && !shouldMock) {
      const redirectUrl = process.env.PAY_RETURN_URL || "http://localhost:5173/payment-return";
      const ipnUrl =
        process.env.MOMO_IPN_URL || "http://localhost:4000/api/payments/webhooks/momo";
      const orderInfo = `BuaComXanh ${campaign_id}`;

      const data = await momoCreatePayment({
        amount,
        orderId,
        orderInfo,
        redirectUrl,
        ipnUrl,
        partnerCode: process.env.MOMO_PARTNER_CODE,
        accessKey: process.env.MOMO_ACCESS_KEY,
        secretKey: process.env.MOMO_SECRET_KEY,
        endpoint:
          process.env.MOMO_CREATE_ENDPOINT ||
          "https://test-payment.momo.vn/v2/gateway/api/create",
      });

      if (data?.resultCode === 0 && data?.payUrl) {
        return res.json({ ok: true, pay_url: data.payUrl, momoRaw: data });
      }
      console.warn("[MoMo create fail]", data);
      // rơi xuống mock khi sandbox lỗi
    }

    // Fallback: QR mock (để FE test được ngay)
    const label = encodeURIComponent(`BuaComXanh #${campaign_id} ${amount}VND via ${method}`);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256">
      <rect width="100%" height="100%" fill="#fff"/>
      <rect x="16" y="16" width="224" height="224" fill="#000" opacity="0.07"/>
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="14" fill="#111">QR ${label}</text>
    </svg>`;
    return res.json({ ok: true, qr_svg: svg });
  } catch (e) {
    console.error("[/payments/create]", e);
    return res.status(500).json({ ok: false, message: "Không tạo được giao dịch" });
  }
});

/* =================== POST /api/payments/webhooks/momo ======================= */
/** IPN MoMo → verify HMAC → ghi donations, update payments */
router.post("/webhooks/momo", async (req, res) => {
  try {
    const data = req.body || {};
    const okSig = momoVerifyIPN({ data, secretKey: process.env.MOMO_SECRET_KEY || "" });
    if (!okSig) return res.status(400).json({ resultCode: 5, message: "invalid signature" });

    const resultCode = Number(data.resultCode);
    const amount = Number(data.amount || 0);
    const orderId = String(data.orderId || "");
    const parts = orderId.split("-"); // METHOD-CAMPAIGNID-timestamp
    const campaign_id = parts?.[1] ? Number(parts[1]) : null;

    if (campaign_id && resultCode === 0) {
      await dbRun(
        `INSERT INTO donations
           (campaign_id, type, amount, qty, currency, donor_name, donor_note, memo, status, paid_at, created_at)
         VALUES
           (?, 'money', ?, 0, 'VND', NULL, NULL, 'MOMO', 'success', ?, ?)`,
        [campaign_id, amount, nowSQL(), nowSQL()]
      ).catch(() => null);

      await dbRun(
        `UPDATE payments SET status='success', updated_at=?
           WHERE method='MOMO' AND campaign_id=?
           ORDER BY id DESC LIMIT 1`,
        [nowSQL(), campaign_id]
      ).catch(() => null);
    } else if (campaign_id) {
      await dbRun(
        `UPDATE payments SET status='failed', updated_at=?
           WHERE method='MOMO' AND campaign_id=?
           ORDER BY id DESC LIMIT 1`,
        [nowSQL(), campaign_id]
      ).catch(() => null);
    }

    return res.json({ resultCode: 0, message: "ok" });
  } catch (e) {
    console.error("[momo ipn]", e);
    return res.json({ resultCode: 0, message: "ok" }); // tránh MoMo retry dồn
  }
});

/* ========================= GET /api/payments/transactions ==================== */
router.get("/transactions", async (req, res) => {
  try {
    const from = String(req.query.from || "1970-01-01");
    const to = String(req.query.to || "2999-12-31");
    const rows = await dbAll(
      `SELECT id, campaign_id, type, amount, qty, currency, status, memo, paid_at, created_at
         FROM donations
        WHERE COALESCE(paid_at, created_at) BETWEEN ? AND ?
        ORDER BY COALESCE(paid_at, created_at) DESC, id DESC`,
      [from, to]
    );
    res.json({ ok: true, items: rows });
  } catch (e) {
    console.error("[transactions]", e);
    res.status(500).json({ ok: false, message: "Không lấy được giao dịch" });
  }
});

export default router;
