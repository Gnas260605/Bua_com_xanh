// src/routes/payments.momo.js
import express from "express";
import crypto from "crypto";

const router = express.Router();

/* ==================== DB adapter ==================== */
const useMySQL = (process.env.DB_DRIVER || "sqlite") === "mysql";
let db;
if (useMySQL) {
  ({ db } = await import("../lib/db.mysql.js")); // export { db } là mysql2/promise connection/pool
} else {
  ({ db } = await import("../lib/db.js"));       // better-sqlite3
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
    const [r] = await db.query(sql, params);
    return r;
  }
  return db.prepare(sql).run(...params);
}

/* ==================== Helpers ==================== */
const safe = (v) => (v == null ? "" : String(v));

function hmacSHA256(secret, data) {
  return crypto.createHmac("sha256", secret).update(data).digest("hex");
}

function buildCreateRawSig({
  accessKey, amount, extraData, ipnUrl, orderId, orderInfo,
  partnerCode, redirectUrl, requestId, requestType
}) {
  return (
    `accessKey=${accessKey}` +
    `&amount=${amount}` +
    `&extraData=${extraData}` +
    `&ipnUrl=${ipnUrl}` +
    `&orderId=${orderId}` +
    `&orderInfo=${orderInfo}` +
    `&partnerCode=${partnerCode}` +
    `&redirectUrl=${redirectUrl}` +
    `&requestId=${requestId}` +
    `&requestType=${requestType}`
  );
}

// Chuỗi ký IPN: các key a→z + accessKey
function buildIpnRawSig(accessKey, body) {
  const b = body || {};
  return (
    `accessKey=${accessKey}` +
    `&amount=${safe(b.amount)}` +
    `&extraData=${safe(b.extraData)}` +
    `&message=${safe(b.message)}` +
    `&orderId=${safe(b.orderId)}` +
    `&orderInfo=${safe(b.orderInfo)}` +
    `&orderType=${safe(b.orderType)}` +
    `&partnerCode=${safe(b.partnerCode)}` +
    `&payType=${safe(b.payType)}` +
    `&requestId=${safe(b.requestId)}` +
    `&responseTime=${safe(b.responseTime)}` +
    `&resultCode=${safe(b.resultCode)}` +
    `&transId=${safe(b.transId)}`
  );
}

/* ==================== Create payment ==================== */
// (giữ nguyên phần /create của bạn – không đổi)
router.post("/create", async (req, res, next) => {
  try {
    const {
      MOMO_PARTNER_CODE = "MOMO",
      MOMO_ACCESS_KEY,
      MOMO_SECRET_KEY,
      MOMO_REDIRECT_URL = "http://localhost:4000/api/payments/momo/return",
      MOMO_IPN_URL = "http://localhost:4000/api/payments/momo/ipn",
      MOMO_CREATE_ENDPOINT,
      MOMO_API_CREATE,
      MOMO_CREATE_URL,
      PAYMENTS_FORCE_MOCK = "0",
    } = process.env;

    const CREATE_URL =
      MOMO_CREATE_ENDPOINT || MOMO_API_CREATE || MOMO_CREATE_URL ||
      "https://test-payment.momo.vn/v2/gateway/api/create";

    const amount = Number(req.body?.amount || 0);
    if (!Number.isFinite(amount) || amount < 1000) {
      return res.status(400).json({ error: "amount không hợp lệ (>= 1.000 VND)" });
    }

    const isLocalCb =
      /localhost|127\.0\.0\.1/.test(MOMO_REDIRECT_URL || "") ||
      /localhost|127\.0\.0\.1/.test(MOMO_IPN_URL || "");
    const shouldMock =
      PAYMENTS_FORCE_MOCK === "1" || !MOMO_ACCESS_KEY || !MOMO_SECRET_KEY || isLocalCb;

    if (shouldMock) {
      const label = encodeURIComponent(`BuaComXanh ${amount}VND via MOMO`);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256">
        <rect width="100%" height="100%" fill="#fff"/>
        <rect x="16" y="16" width="224" height="224" fill="#000" opacity="0.07"/>
        <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="14" fill="#111">QR ${label}</text>
      </svg>`;
      return res.json({ ok: true, qr_svg: svg, mock: true });
    }

    if (!process.env.MOMO_IPN_URL) {
      return res.status(400).json({ error: "MOMO_IPN_URL bắt buộc (không được trống)" });
    }

    const partnerCode = MOMO_PARTNER_CODE;
    const orderInfo =
      (req.body?.orderInfo && String(req.body.orderInfo).slice(0, 190)) ||
      "Ung ho chien dich";

    let extraData = "";
    if (req.body?.extraData != null) {
      try {
        extraData = Buffer.from(
          typeof req.body.extraData === "string"
            ? req.body.extraData
            : JSON.stringify(req.body.extraData)
        ).toString("base64");
      } catch {
        extraData = String(req.body.extraData);
      }
    }

    const requestType = "captureWallet";
    const orderId = partnerCode + Date.now();
    const requestId = orderId;
    const lang = "vi";

    const rawSignature = buildCreateRawSig({
      accessKey: process.env.MOMO_ACCESS_KEY,
      amount,
      extraData,
      ipnUrl: process.env.MOMO_IPN_URL,
      orderId,
      orderInfo,
      partnerCode,
      redirectUrl: process.env.MOMO_REDIRECT_URL,
      requestId,
      requestType,
    });
    const signature = hmacSHA256(process.env.MOMO_SECRET_KEY, rawSignature);

    const payload = {
      partnerCode,
      partnerName: "BuaComXanh",
      storeId: "BXC",
      requestId,
      amount,
      orderId,
      orderInfo,
      redirectUrl: process.env.MOMO_REDIRECT_URL,
      ipnUrl: process.env.MOMO_IPN_URL,
      lang,
      requestType,
      extraData,
      signature,
    };

    const resp = await fetch(CREATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    let data = null;
    try { data = await resp.json(); } catch {}

    if (!resp.ok || data?.resultCode !== 0 || !data?.payUrl) {
      console.warn("[MoMo create] FAIL", { status: resp.status, resultCode: data?.resultCode, message: data?.message, subErrors: data?.subErrors });
      return res.status(400).json({
        error: data?.message || "MoMo create error",
        resultCode: data?.resultCode,
        momoRaw: data,
      });
    }

    // (tuỳ kiến trúc) Nếu bạn muốn tạo trước một dòng donations 'pending' khi tạo đơn:
    // await dbRun(
    //   `INSERT INTO donations (order_id, campaign_id, type, amount, currency, status, created_at)
    //    VALUES (?, ?, 'money', ?, 'VND', 'pending', NOW())`,
    //   [orderId, req.body?.campaign_id || null, amount]
    // );

    return res.json({
      ok: true,
      payUrl: data.payUrl,
      deeplink: data.deeplink,
      qrCodeUrl: data.qrCodeUrl,
      momoRaw: data,
    });
  } catch (err) {
    next(err);
  }
});

/* ==================== Return page (GET) ==================== */
router.get("/return", (req, res) => {
  const rc = Number(req.query.resultCode ?? req.body?.resultCode ?? NaN);
  const ok = rc === 0;
  const html = `<!doctype html>
  <meta charset="utf-8"/>
  <title>MoMo Return</title>
  <style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:24px}</style>
  <h1>${ok ? "✅ Thanh toán thành công" : "❌ Thanh toán thất bại"}</h1>
  <p>orderId: ${safe(req.query.orderId)}</p>
  <p>amount: ${safe(req.query.amount)}</p>
  <p>message: ${safe(req.query.message)}</p>
  <p>resultCode: ${safe(req.query.resultCode)}</p>
  <p>Bạn có thể đóng tab này.</p>`;
  res.status(200).send(html);
});

/* ==================== IPN (POST) ==================== */
// XÁC THỰC chữ ký → cập nhật donations (idempotent)
router.post("/ipn", express.json({ type: "*/*" }), async (req, res) => {
  try {
    const body = req.body || {};
    const accessKey = process.env.MOMO_ACCESS_KEY || "";
    const secretKey = process.env.MOMO_SECRET_KEY || "";

    // 1) Verify signature
    const rawSig = buildIpnRawSig(accessKey, body);
    const expected = hmacSHA256(secretKey, rawSig);
    const valid = expected === body.signature;

    // 2) Parse extraData (base64 → JSON) để lấy campaign_id nếu cần
    let extra = {};
    try {
      if (body.extraData) {
        const s = Buffer.from(String(body.extraData), "base64").toString("utf8");
        extra = JSON.parse(s);
      }
    } catch { extra = {}; }

    const orderId = String(body.orderId || "");
    const amount = Number(body.amount || 0);
    const transId = String(body.transId || "");
    const message = String(body.message || "");
    const resultCode = Number(body.resultCode ?? 99);

    // 3) Xử lý idempotent: chỉ set success lần đầu
    // Nếu có dòng pending thì update, nếu chưa có thì insert
    const row = await dbGet(`SELECT id, status FROM donations WHERE order_id = ? LIMIT 1`, [orderId]);

    const paidAt =
      body.responseTime && !Number.isNaN(Number(body.responseTime))
        ? new Date(Number(body.responseTime))
        : new Date();

    if (resultCode === 0 && valid) {
      if (row) {
        // chỉ cập nhật khi chưa success
        if (row.status !== "success") {
          if (useMySQL) {
            await dbRun(
              `UPDATE donations
               SET status='success',
                   paid_at=?,
                   bank_txn_id=?,
                   bank_code=?,
                   memo=?,
                   amount=COALESCE(?, amount)
               WHERE order_id=?`,
              [paidAt, transId, body.bankCode || null, message, amount || null, orderId]
            );
          } else {
            await dbRun(
              `UPDATE donations
               SET status='success',
                   paid_at=?,
                   bank_txn_id=?,
                   bank_code=?,
                   memo=?,
                   amount=COALESCE(?, amount)
               WHERE order_id=?`,
              [paidAt.toISOString(), transId, body.bankCode || null, message, amount || null, orderId]
            );
          }
        }
      } else {
        // chưa có thì tạo mới 1 dòng success (trường hợp bạn chưa insert lúc /create)
        if (useMySQL) {
          await dbRun(
            `INSERT INTO donations (order_id, campaign_id, type, amount, currency, status, paid_at, bank_txn_id, bank_code, memo, created_at)
             VALUES (?, ?, 'money', ?, 'VND', 'success', ?, ?, ?, ?, NOW())`,
            [orderId, extra.campaign_id || null, amount, paidAt, transId, body.bankCode || null, message]
          );
        } else {
          await dbRun(
            `INSERT INTO donations (order_id, campaign_id, type, amount, currency, status, paid_at, bank_txn_id, bank_code, memo, created_at)
             VALUES (?, ?, 'money', ?, 'VND', 'success', ?, ?, ?, ?, datetime('now'))`,
            [orderId, extra.campaign_id || null, amount, paidAt.toISOString(), transId, body.bankCode || null, message]
          );
        }
      }
    } else {
      // thất bại → đánh dấu failed nếu có dòng pending
      if (row && row.status === "pending") {
        if (useMySQL) {
          await dbRun(
            `UPDATE donations
             SET status='failed', memo=?, bank_txn_id=?, bank_code=?, paid_at=COALESCE(paid_at, ?)
             WHERE order_id=?`,
            [message || "failed", transId, body.bankCode || null, paidAt, orderId]
          );
        } else {
          await dbRun(
            `UPDATE donations
             SET status='failed', memo=?, bank_txn_id=?, bank_code=?, paid_at=COALESCE(paid_at, ?)
             WHERE order_id=?`,
            [message || "failed", transId, body.bankCode || null, paidAt.toISOString(), orderId]
          );
        }
      }
    }

    // 4) Trả 204 theo chuẩn MoMo (MoMo coi là nhận OK)
    return res.status(204).end();
  } catch (e) {
    // vẫn trả 204 để MoMo không retry vô hạn (tuỳ chọn)
    console.error("[MoMo IPN] error", e);
    return res.status(204).end();
  }
});

export default router;
