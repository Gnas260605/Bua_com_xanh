import { Router } from "express";
import crypto from "crypto";
import "dotenv/config";

const useMySQL = (process.env.DB_DRIVER || "sqlite") === "mysql";
let db;
if (useMySQL) ({ db } = await import("../lib/db.mysql.js"));
else ({ db } = await import("../lib/db.js"));

const router = Router();

function hmacOk(req) {
  // tuỳ nhà cung cấp, thường gửi X-Signature = HMAC(body, secret)
  const secret = process.env.WEBHOOK_SECRET || "";
  if (!secret) return true; // demo
  const sig = req.get("X-Signature") || "";
  const raw = JSON.stringify(req.body);
  const h = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(h), Buffer.from(sig));
}

async function dbGet(sql, params=[]) {
  if (useMySQL) {
    if (db.get) return await db.get(sql, params);
    const [rows] = await db.query(sql, params);
    return rows?.[0] ?? null;
  }
  return db.prepare(sql).get(...params);
}
async function dbAll(sql, params=[]) {
  if (useMySQL) {
    if (db.all) return await db.all(sql, params);
    const [rows] = await db.query(sql, params);
    return rows ?? [];
  }
  return db.prepare(sql).all(...params);
}

router.post("/bank/vietqr", async (req, res) => {
  try {
    if (!hmacOk(req)) return res.status(401).json({ ok:false, error:"bad_signature" });

    // ví dụ payload chuẩn hoá (tuỳ provider đổi mapping)
    const {
      bank_txn_id,          // duy nhất
      amount,               // số tiền VND
      memo,                 // "BXA#11111111|..."
      paid_at,              // ISO hoặc epoch
      from_bank,            // VCB/TCB...
      from_name,            // tên người gửi
      from_account,         // số TKG gửi (nếu có)
      currency = "VND",
    } = req.body || {};

    if (!bank_txn_id || !amount) {
      return res.status(422).json({ ok:false, error:"invalid_payload" });
    }

    // match campaign_id theo memo: BXA#12345
    const m = String(memo || "").match(/BXA#(\d+)/i);
    const campaignId = m ? Number(m[1]) : null;
    if (!campaignId) {
      // không tìm thấy campaign -> bạn có thể log pending để manual review
      await dbAll(
        `INSERT IGNORE INTO donations (campaign_id, type, amount, currency, donor_name,
          bank_txn_id, bank_code, bank_account, memo, status, paid_at)
         VALUES (0,'money',?,?,?, ?,?,?,?,'pending', ?)`,
        [Number(amount)||0, currency, from_name||"", bank_txn_id, from_bank||"", from_account||"", memo||"", paid_at||null]
      );
      return res.json({ ok:true, pending:true });
    }

    // chèn donation (idempotent nhờ UNIQUE bank_txn_id)
    await dbAll(
      `INSERT IGNORE INTO donations (campaign_id, type, amount, currency, donor_name,
        bank_txn_id, bank_code, bank_account, memo, status, paid_at)
       VALUES (?,?,?,?,?, ?,?,?,?, 'success', ?)`,
      [campaignId, 'money', Number(amount)||0, currency, from_name||"",
       bank_txn_id, from_bank||"", from_account||"", memo||"", paid_at||null]
    );

    // cộng dồn raised trong campaigns
    await dbAll(
      useMySQL
        ? "UPDATE campaigns SET raised = COALESCE(raised,0) + ? WHERE id=?"
        : "UPDATE campaigns SET raised = COALESCE(raised,0) + ? WHERE id=?",
      [Number(amount)||0, campaignId]
    );

    return res.json({ ok:true });
  } catch (e) {
    console.error("[webhook vietqr] error:", e);
    return res.status(500).json({ ok:false, error:"server_error" });
  }
});

export default router;
