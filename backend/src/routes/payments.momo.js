import express from "express";
import crypto from "crypto";

const router = express.Router();

/* ==================== DB adapter ==================== */
const useMySQL = (process.env.DB_DRIVER || "sqlite") === "mysql";
let db;
if (useMySQL) {
  ({ db } = await import("../lib/db.mysql.js"));
} else {
  ({ db } = await import("../lib/db.js"));
}

async function dbGet(sql, params = []) {
  if (useMySQL) {
    const [rows] = await db.query(sql, params);
    return rows?.[0] ?? null;
  }
  return db.prepare(sql).get(...params);
}
async function dbAll(sql, params = []) {
  if (useMySQL) {
    const [rows] = await db.query(sql, params);
    return rows ?? [];
  }
  return db.prepare(sql).all(...params);
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
router.post("/create", async (req, res, next) => {
  try {
    const {
      MOMO_PARTNER_CODE = "MOMO",
      MOMO_ACCESS_KEY,
      MOMO_SECRET_KEY,
      MOMO_REDIRECT_URL = "http://localhost:4000/api/payments/momo/return",
      MOMO_IPN_URL = "http://localhost:4000/api/payments/momo/ipn",
      MOMO_CREATE_URL,
      PAYMENTS_FORCE_MOCK = "0",
    } = process.env;

    const CREATE_URL = MOMO_CREATE_URL || "https://test-payment.momo.vn/v2/gateway/api/create";

    const amount = Number(req.body?.amount || 0);
    if (!Number.isFinite(amount) || amount < 1000) {
      return res.status(400).json({ error: "amount không hợp lệ (>= 1.000 VND)" });
    }

    const partnerCode = MOMO_PARTNER_CODE;
    const orderId = partnerCode + Date.now();
    const requestId = orderId;

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
    const rawSignature = buildCreateRawSig({
      accessKey: MOMO_ACCESS_KEY,
      amount,
      extraData,
      ipnUrl: MOMO_IPN_URL,
      orderId,
      orderInfo,
      partnerCode,
      redirectUrl: MOMO_REDIRECT_URL,
      requestId,
      requestType,
    });
    const signature = hmacSHA256(MOMO_SECRET_KEY, rawSignature);

    const payload = {
      partnerCode,
      partnerName: "BuaComXanh",
      storeId: "BXC",
      requestId,
      amount,
      orderId,
      orderInfo,
      redirectUrl: MOMO_REDIRECT_URL,
      ipnUrl: MOMO_IPN_URL,
      lang: "vi",
      requestType,
      extraData,
      signature,
    };

    // Insert donation pending
    await dbRun(
      `INSERT INTO donations (order_id, campaign_id, type, amount, currency, status, created_at)
       VALUES (?, ?, 'money', ?, 'VND', 'pending', NOW())`,
      [orderId, req.body?.campaign_id || null, amount]
    );

    // Mock mode
    const isLocal = /localhost|127\.0\.0\.1/.test(MOMO_REDIRECT_URL);
    if (PAYMENTS_FORCE_MOCK === "1" || isLocal) {
      return res.json({ ok: true, payUrl: `/mock-momo/${orderId}`, mock: true });
    }

    const resp = await fetch(CREATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await resp.json().catch(() => null);

    if (!resp.ok || data?.resultCode !== 0 || !data?.payUrl) {
      return res.status(400).json({
        error: data?.message || "MoMo create error",
        resultCode: data?.resultCode,
        momoRaw: data,
      });
    }

    return res.json({
      ok: true,
      payUrl: data.payUrl,
      deeplink: data.deeplink,
      qrCodeUrl: data.qrCodeUrl,
    });
  } catch (err) {
    next(err);
  }
});

/* ==================== Return page ==================== */
router.get("/return", (req, res) => {
  const rc = Number(req.query.resultCode ?? NaN);
  const ok = rc === 0;
  res.send(`<h1>${ok ? "✅ Thành công" : "❌ Thất bại"}</h1>
    <p>orderId: ${safe(req.query.orderId)}</p>
    <p>amount: ${safe(req.query.amount)}</p>`);
});

/* ==================== IPN ==================== */
router.post("/ipn", express.json({ type: "*/*" }), async (req, res) => {
  try {
    const body = req.body || {};
    const rawSig = buildIpnRawSig(process.env.MOMO_ACCESS_KEY, body);
    const expected = hmacSHA256(process.env.MOMO_SECRET_KEY, rawSig);
    const valid = expected === body.signature;

    const orderId = String(body.orderId || "");
    const amount = Number(body.amount || 0);
    const transId = String(body.transId || "");
    const resultCode = Number(body.resultCode ?? 99);
    const paidAt = new Date();

    const row = await dbGet(`SELECT id, status FROM donations WHERE order_id = ?`, [orderId]);

    if (resultCode === 0 && valid) {
      if (row) {
        if (row.status !== "success") {
          await dbRun(
            `UPDATE donations SET status='success', paid_at=?, bank_txn_id=?, bank_code=? WHERE order_id=?`,
            [paidAt, transId, body.bankCode || null, orderId]
          );
        }
      }
    } else {
      if (row && row.status === "pending") {
        await dbRun(
          `UPDATE donations SET status='failed', memo=? WHERE order_id=?`,
          [body.message || "failed", orderId]
        );
      }
    }
    res.status(204).end();
  } catch (e) {
    console.error("[MoMo IPN] error", e);
    res.status(204).end();
  }
});

/* ==================== History ==================== */
router.get("/history/:userId", async (req, res, next) => {
  try {
    const rows = await dbAll(
      `SELECT d.*, c.title as campaign_title
       FROM donations d
       LEFT JOIN campaigns c ON d.campaign_id = c.id
       WHERE d.user_id = ?
       ORDER BY d.created_at DESC`,
      [req.params.userId]
    );
    res.json({ ok: true, items: rows });
  } catch (err) {
    next(err);
  }
});

export default router;
