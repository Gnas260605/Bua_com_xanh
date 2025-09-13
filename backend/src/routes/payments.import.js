import { Router } from "express";
import multer from "multer";
import { parse } from "csv-parse/sync";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import "dotenv/config";

const useMySQL = (process.env.DB_DRIVER || "sqlite") === "mysql";
let db;
if (useMySQL) ({ db } = await import("../lib/db.mysql.js"));
else ({ db } = await import("../lib/db.js"));

const router = Router();
const upload = multer();

/* ------------------------------ DB helpers ------------------------------ */
async function dbAll(sql, params = []) {
  if (useMySQL) {
    if (typeof db.all === "function") return await db.all(sql, params);
    const [rows] = await db.query(sql, params);
    return rows ?? [];
  }
  return db.prepare(sql).all(...params);
}
async function dbRun(sql, params = []) {
  if (useMySQL) {
    // mysql2/promise: db.execute/query đều trả [rows, fields]
    const [rows] = await db.query(sql, params);
    return rows;
  }
  return db.prepare(sql).run(...params);
}
async function dbGet(sql, params = []) {
  if (useMySQL) {
    const [rows] = await db.query(sql, params);
    return rows?.[0] ?? null;
  }
  return db.prepare(sql).get(...params);
}

/* ------------------------------ utils ------------------------------ */
function toNumberLoose(v) {
  if (v == null) return 0;
  const s = String(v)
    .replace(/\s+/g, "")
    .replace(/[₫,]/g, "")         // bỏ phân cách ngàn và ký hiệu VND
    .replace(/\.?(?=\d{3}\b)/g, ""); // nắn một số định dạng lạ
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function pick(obj, keys) {
  const o = {};
  for (const k of keys) if (obj[k] !== undefined) o[k] = obj[k];
  return o;
}

function parsePaidAt(v) {
  if (!v) return null;
  // chấp nhận "YYYY-MM-DD HH:mm:ss", "DD/MM/YYYY", ...
  const d = new Date(v);
  if (isNaN(+d)) return null;
  // Trả về chuỗi MySQL DATETIME 'YYYY-MM-DD HH:mm:ss'
  const pad = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/* 
  API: POST /admin/payments/import-csv
  form-data: file=<CSV file>
*/
router.post(
  "/admin/payments/import-csv",
  requireAuth,
  requireRole("admin"),
  upload.single("file"),
  async (req, res) => {
    try {
      const csvBuf = req.file?.buffer;
      if (!csvBuf) return res.status(400).json({ ok: false, error: "missing_file" });

      const rows = parse(csvBuf, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });

      let scanned = 0;
      let inserted = 0;
      let updated = 0;
      let matchedCampaign = 0;

      for (const r of rows) {
        scanned++;

        // Map linh hoạt theo nhiều mẫu file ngân hàng
        const bank_txn_id = String(
          r.TransID ?? r.TxnID ?? r["Transaction ID"] ?? r["Trans Id"] ?? ""
        ).trim();

        const amount = toNumberLoose(r.Amount ?? r.Credit ?? r["Credit Amount"] ?? r["Deposit"] ?? 0);

        const memo = String(
          r.Description ?? r.Narration ?? r["Transaction Details"] ?? r["Details"] ?? ""
        ).trim();

        const paid_at_raw = r.Date ?? r["Transaction Date"] ?? r["Value Date"] ?? null;
        const paid_at = parsePaidAt(paid_at_raw);

        if (!bank_txn_id || !amount) {
          continue; // bỏ qua dòng rác
        }

        // Bóc mã chiến dịch BXA#<id>
        const m = memo.match(/BXA#(\d+)/i);
        let campaignId = m ? Number(m[1]) : null;

        // Chỉ gán campaign_id nếu tồn tại thật để tránh lỗi FK
        if (campaignId) {
          const found = await dbGet("SELECT id FROM campaigns WHERE id = ?", [campaignId]);
          if (!found) campaignId = null;
        }

        /* ---------- Ghi nhận donation ---------- */
        if (useMySQL) {
          // Yêu cầu donations.bank_txn_id UNIQUE
          const sql =
            `INSERT INTO donations (campaign_id, type, amount, memo, bank_txn_id, status, paid_at)
             VALUES (?, 'money', ?, ?, ?, 'success', ?)
             ON DUPLICATE KEY UPDATE
               amount = VALUES(amount),
               memo = VALUES(memo),
               paid_at = VALUES(paid_at)`;
          const result = await dbRun(sql, [campaignId, amount, memo, bank_txn_id, paid_at]);
          // mysql2: result.affectedRows = 1 (insert) | 2 (update row because of duplicate key)
          if (result?.affectedRows === 1) inserted++;
          else if (result?.affectedRows >= 2) updated++;
        } else {
          // SQLite: tạo UNIQUE(bank_txn_id) nếu có. Nếu chưa, ta emulate nhẹ
          try {
            await dbRun(
              `INSERT OR IGNORE INTO donations (campaign_id, type, amount, memo, bank_txn_id, status, paid_at)
               VALUES (?, 'money', ?, ?, ?, 'success', ?)`,
              [campaignId, amount, memo, bank_txn_id, paid_at]
            );
            // Thử update nếu đã tồn tại
            const upd = await dbRun(
              `UPDATE donations
                 SET amount=?, memo=?, paid_at=?
               WHERE bank_txn_id=?`,
              [amount, memo, paid_at, bank_txn_id]
            );
            if (upd?.changes) updated += upd.changes;
            else inserted++;
          } catch {
            // fallback im lặng
          }
        }

        /* ---------- Cộng dồn raised cho campaign (nếu match) ---------- */
        if (campaignId) {
          await dbRun(
            `UPDATE campaigns SET raised = COALESCE(raised,0) + ? WHERE id = ?`,
            [amount, campaignId]
          );
          matchedCampaign++;
        }
      }

      return res.json({
        ok: true,
        scanned,
        inserted,
        updated,
        matchedCampaign,
      });
    } catch (e) {
      console.error("[import-csv] error:", e);
      return res.status(500).json({ ok: false, error: e?.message || "server_error" });
    }
  }
);

export default router;
