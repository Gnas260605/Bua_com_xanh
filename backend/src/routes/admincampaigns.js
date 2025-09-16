// backend/src/routes/admincampaigns.js (ESM)
import { Router } from "express";
import crypto from "crypto";
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

/* ========================= DB helpers ========================= */
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
async function dbRun(sql, params = []) {
  try {
    if (useMySQL) {
      if (typeof db.run === "function") return await db.run(sql, params);
      if (typeof db.query === "function") {
        const [result] = await db.query(sql, params);
        return result; // .insertId for INSERT
      }
      throw new Error("MySQL adapter missing .run/.query");
    }
    return db.prepare(sql).run(...params);
  } catch (e) {
    throw new Error(`dbRun failed: ${e?.message || e}`);
  }
}

/* ========================= Utils ========================= */
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const toNum = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const safe = (v, d = "") => (v == null ? d : String(v));
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

/* ========================= Meta helpers ========================= */
function buildMetaJson(c = {}) {
  const paymentMethod = c.payment?.method || c.payment_method || "momo"; // momo | vietqr | custom_qr
  const payment =
    paymentMethod === "momo"
      ? { method: "momo" }
      : paymentMethod === "custom_qr"
        ? { method: "custom_qr", qr_url: c.payment?.qr_url || c.payment_qr_url || "" }
        : {
          method: "vietqr",
          bank: c.payment?.bank || c.payment_bank || "",
          account: c.payment?.account || c.payment_account || "",
          name: c.payment?.name || c.payment_name || "",
          memo: c.payment?.memo || c.payment_memo || "",
          qr_url: c.payment?.qr_url || c.payment_qr_url || "",
        };

  const meta = {
    type: c.type || c.meta?.type || "money",
    start_at: c.start_at ?? c.meta?.start_at ?? null,
    end_at: c.end_at ?? c.meta?.end_at ?? null,
    payment,
    meal: {
      unit: c.meal_unit || c.meta?.meal?.unit || "phần",
      target_qty: toNum(c.meal_target_qty ?? c.meta?.meal?.target_qty, 0),
      received_qty: toNum(c.meal_received_qty ?? c.meta?.meal?.received_qty, 0),
      wish: c.meal_wish || c.meta?.meal?.wish || "",
      // có thể lưu thêm price vào meta để tương thích FE cũ
      price: toNum(c.meal_price ?? c.meta?.meal?.price, 0),
    },
  };
  return JSON.stringify(meta);
}

/** Row → FE object (ưu tiên cột nếu có, fallback về tags) */
function mapCampaignRow(r) {
  const meta = parseJson(r.tags, {});
  const type = safe(r.type ?? meta?.type ?? "money");

  const cover_url = r.cover_url || r.cover || "";
  const target_amount = toNum(r.target_amount ?? r.goal, 0);
  const raised_amount = toNum(r.raised_amount ?? r.raised, 0);

  // meal columns + fallback meta
  const meal_price = toNum(r.meal_price ?? meta?.meal?.price, 0);
  const meal_received_qty = toNum(r.meal_received_qty ?? meta?.meal?.received_qty, 0);
  const meal_target_qty = toNum(meta?.meal?.target_qty, 0);
  const meal_unit = meta?.meal?.unit || "phần";

  const payment_method = meta?.payment?.method || "momo";

  return {
    id: r.id,
    title: r.title,
    description: r.description,
    location: r.location,
    target_amount,
    raised_amount,
    supporters: toNum(r.supporters, 0),
    status: r.status,
    created_at: r.created_at,
    updated_at: r.updated_at,
    deadline: r.deadline,
    cover_url,
    // meta expanded
    meta,
    type,
    payment_method,
    meal_unit,
    meal_target_qty,
    meal_received_qty,
    meal_price,
    start_at: meta?.start_at || null,
    end_at: meta?.end_at || null,
    payment: meta?.payment || null,
    tags: normalizeTags(r.tags),
  };
}

/* ========================= Init / Migrations (giữ nguyên) ========================= */
async function ensureDonationsTable() {
  if (useMySQL) {
    await dbRun(
      `CREATE TABLE IF NOT EXISTS donations (
         id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
         campaign_id VARCHAR(191) NOT NULL,
         type VARCHAR(20) NOT NULL DEFAULT 'money',
         amount BIGINT NULL,
         qty BIGINT NULL,
         currency VARCHAR(10) NOT NULL DEFAULT 'VND',
         donor_name VARCHAR(191) NULL,
         donor_note TEXT NULL,
         memo TEXT NULL,
         status VARCHAR(20) NOT NULL DEFAULT 'success',
         paid_at DATETIME NULL,
         bank_txn_id VARCHAR(191) NULL,
         created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
         UNIQUE KEY uniq_bank_txn_id (bank_txn_id),
         INDEX idx_campaign_paid (campaign_id, paid_at)
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`
    );
  } else {
    await dbRun(
      `CREATE TABLE IF NOT EXISTS donations (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         campaign_id TEXT NOT NULL,
         type TEXT NOT NULL DEFAULT 'money',
         amount INTEGER,
         qty INTEGER,
         currency TEXT NOT NULL DEFAULT 'VND',
         donor_name TEXT,
         donor_note TEXT,
         memo TEXT,
         status TEXT NOT NULL DEFAULT 'success',
         paid_at TEXT,
         bank_txn_id TEXT UNIQUE,
         created_at TEXT NOT NULL DEFAULT (datetime('now'))
       );`
    );
  }
}
async function ensureCampaignTypeColumn() {
  try {
    if (useMySQL) {
      await dbRun(`ALTER TABLE campaigns ADD COLUMN \`type\` VARCHAR(20) NULL`);
      await dbRun(`CREATE INDEX idx_campaigns_type ON campaigns (\`type\`)`);
    } else {
      await dbRun(`ALTER TABLE campaigns ADD COLUMN type TEXT`);
    }
  } catch { }
}
async function reconcileCampaignTypes() {
  try {
    if (useMySQL) {
      await dbRun(
        `UPDATE campaigns
         SET \`type\` = JSON_UNQUOTE(JSON_EXTRACT(tags, '$.type'))
         WHERE JSON_VALID(tags)
           AND JSON_EXTRACT(tags, '$.type') IS NOT NULL
           AND ( \`type\` IS NULL OR \`type\` = '' )`
      );
    } else {
      const rows = await dbAll(`SELECT id, tags, type FROM campaigns`, []);
      for (const r of rows) {
        const meta = parseJson(r.tags, {});
        const t = meta?.type;
        if (t && (!r.type || r.type !== t)) {
          await dbRun(`UPDATE campaigns SET type=? WHERE id=?`, [String(t), r.id]);
        }
      }
    }
  } catch (e) {
    console.warn("[reconcileCampaignTypes] skipped:", e?.message || e);
  }
}

await ensureDonationsTable();
await ensureCampaignTypeColumn();
await reconcileCampaignTypes();

/* ========================= Core helpers (giữ nguyên logic) ========================= */
async function applyDonationToCampaign({ campaign_id, type = "money", amount = 0, qty = 0 }) {
  const exists = await dbGet(`SELECT id, tags FROM campaigns WHERE id=?`, [campaign_id]);
  if (!exists) return;

  if (type === "money") {
    await dbRun(`UPDATE campaigns SET raised = COALESCE(raised,0) + ?, raised_amount = COALESCE(raised_amount,0) + ? WHERE id=?`, [
      toNum(amount, 0),
      toNum(amount, 0),
      campaign_id,
    ]);
  } else {
    const meta = parseJson(exists?.tags, {});
    meta.meal = meta.meal || {};
    meta.meal.received_qty = toNum(meta?.meal?.received_qty, 0) + toNum(qty, 0);
    await dbRun(
      `UPDATE campaigns SET tags=?, meal_received_qty = COALESCE(meal_received_qty,0) + ?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
      [JSON.stringify(meta), toNum(qty, 0), campaign_id]
    );
  }
}
async function recalcCampaignFromDonations(campaign_id) {
  const money = await dbGet(
    `SELECT COALESCE(SUM(amount),0) AS s
     FROM donations WHERE campaign_id=? AND status='success' AND type='money'`,
    [campaign_id]
  );
  const meal = await dbGet(
    `SELECT COALESCE(SUM(qty),0) AS q
     FROM donations WHERE campaign_id=? AND status='success' AND type='meal'`,
    [campaign_id]
  );

  await dbRun(`UPDATE campaigns SET raised=?, raised_amount=? WHERE id=?`, [toNum(money?.s, 0), toNum(money?.s, 0), campaign_id]);

  const row = await dbGet(`SELECT tags FROM campaigns WHERE id=?`, [campaign_id]);
  const meta = parseJson(row?.tags, {});
  meta.meal = meta.meal || {};
  meta.meal.received_qty = toNum(meal?.q, 0);
  await dbRun(
    `UPDATE campaigns SET tags=?, meal_received_qty=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
    [JSON.stringify(meta), toNum(meal?.q, 0), campaign_id]
  );
}

/* ========================= GET / (list) ========================= */
router.get("/", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const status = String(req.query.status || "active").toLowerCase();
    const typeFilter = String(req.query.type || "").toLowerCase();
    const sort = String(req.query.sort || "latest").toLowerCase();
    const page = clamp(parseInt(req.query.page) || 1, 1, 1e6);
    const pageSize = clamp(parseInt(req.query.pageSize) || 10, 1, 100);
    const offset = (page - 1) * pageSize;

    const where = [];
    const params = [];

    if (q) {
      where.push("(title LIKE ? OR description LIKE ? OR location LIKE ?)");
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    if (status && status !== "all") {
      where.push("status = ?");
      params.push(status);
    }
    if (typeFilter) {
      where.push("LOWER(COALESCE(`type`, '')) = ?");
      params.push(typeFilter);
    }

    const whereSQL = where.length ? "WHERE " + where.join(" AND ") : "";

    let orderSQL = "created_at DESC";
    if (sort === "progress") {
      orderSQL = "CASE WHEN goal>0 THEN (raised*1.0/goal) ELSE 0 END DESC, created_at DESC";
    } else if (sort === "goal") {
      orderSQL = "goal DESC, created_at DESC";
    } else if (sort === "endSoon") {
      orderSQL = "CASE WHEN deadline IS NULL THEN 1 ELSE 0 END ASC, deadline ASC, created_at DESC";
    }

    const listSQL = `
      SELECT id, title, description, location, goal, raised, supporters,
             tags, cover, cover_url, status, created_at, updated_at, deadline, \`type\`,
             target_amount, raised_amount, meal_price, meal_received_qty
      FROM campaigns
      ${whereSQL}
      ORDER BY ${orderSQL}
      LIMIT ? OFFSET ?`;
    const countSQL = `SELECT COUNT(*) AS total FROM campaigns ${whereSQL}`;

    const totalRow = await dbGet(countSQL, params);
    const rows = await dbAll(listSQL, [...params, pageSize, offset]);
    const items = rows.map(mapCampaignRow);

    res.json({ ok: true, items, total: toNum(totalRow?.total, 0), page, pageSize });
  } catch (err) {
    console.error("[GET /api/admin/campaigns] error:", err);
    res.status(500).json({ ok: false, message: "Không lấy được danh sách chiến dịch" });
  }
});

/* ========================= GET /stats ========================= */
router.get("/stats", async (_req, res) => {
  try {
    const row = await dbGet(
      `SELECT COUNT(*) AS campaigns,
              COALESCE(SUM(raised_amount),COALESCE(SUM(raised),0)) AS raised,
              COALESCE(SUM(supporters),0) AS supporters,
              SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) AS active
       FROM campaigns`,
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
    console.error("[GET /api/admin/campaigns/stats] error:", err);
    res.status(500).json({ ok: false, message: "Không lấy được thống kê chiến dịch" });
  }
});

/* ========================= GET /:id ========================= */
router.get("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const row = await dbGet(
      `SELECT id, title, description, location, goal, raised, supporters,
              tags, cover, cover_url, status, created_at, updated_at, deadline, \`type\`,
              target_amount, raised_amount, meal_price, meal_received_qty
       FROM campaigns WHERE id=?`,
      [id]
    );
    if (!row) return res.status(404).json({ ok: false, message: "Not found" });
    res.json({ ok: true, ...mapCampaignRow(row) });
  } catch (err) {
    console.error("[GET /api/admin/campaigns/:id] error:", err);
    res.status(500).json({ ok: false, message: "Không lấy được chiến dịch" });
  }
});

/* ========================= GET /:id/donations ========================= */
router.get("/:id/donations", async (req, res) => {
  try {
    const id = req.params.id;
    const items = await dbAll(
      `SELECT id, type, amount, qty, currency, donor_name, donor_note, memo, status, paid_at, created_at
       FROM donations
       WHERE campaign_id=? AND status='success'
       ORDER BY COALESCE(paid_at, created_at) DESC, id DESC
       LIMIT 500`,
      [id]
    ).catch(() => []);
    const safeItems = items.map((it) => ({
      id: it.id,
      type: it.type,
      amount: toNum(it.amount, 0),
      qty: toNum(it.qty, 0),
      currency: it.currency || "VND",
      donor_name: it.donor_name || "Ẩn danh",
      donor_note: it.donor_note || "",
      paid_at: it.paid_at || it.created_at,
      memo: it.memo || "",
    }));
    res.json({ ok: true, items: safeItems });
  } catch (err) {
    console.error("[GET /api/admin/campaigns/:id/donations] error:", err);
    res.status(500).json({ ok: false, message: "Không lấy được danh sách ủng hộ" });
  }
});

/* ========================= POST / (create) ========================= */
router.post("/", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const sqliteId = !useMySQL ? (req.body?.id || crypto.randomUUID()) : null;
    const c = req.body || {};

    const metaJson = c.meta != null ? JSON.stringify(c.meta) : buildMetaJson(c);
    const typeForColumn = (c.meta?.type || c.type || "money").toString();

    const sql = `
      INSERT INTO campaigns (${useMySQL ? "" : "id,"}
        title, description, location,
        goal, raised, supporters,
        tags, cover, cover_url, status, deadline, \`type\`,
        target_amount, raised_amount, meal_price, meal_received_qty,
        created_at
      )
      VALUES (${useMySQL ? "" : "?, "}
        ?,?,?,         -- title, description, location
        ?,?, ?,        -- goal, raised, supporters
        ?,?, ?,?, ?,   -- tags, cover, cover_url, status, deadline
        ?,             -- type
        ?,?, ?,?,      -- target_amount, raised_amount, meal_price, meal_received_qty
        ${useMySQL ? "CURRENT_TIMESTAMP" : "datetime('now')"}
      )`;

    const args = [];
    if (!useMySQL) args.push(sqliteId);
    args.push(
      safe(c.title).trim(),
      safe(c.description),
      safe(c.location),
      toNum(c.target_amount, 0),          // goal
      toNum(c.raised_amount, 0),          // raised
      toNum(c.supporters, 0),
      metaJson,
      safe(c.cover_url),                  // cover
      safe(c.cover_url),                  // cover_url
      safe(c.status, "draft"),
      c.end_at ?? c.deadline ?? null,
      typeForColumn,
      toNum(c.target_amount, 0),          // target_amount
      toNum(c.raised_amount, 0),          // raised_amount
      toNum(c.meal_price, 0),             // meal_price
      toNum(c.meal_received_qty, 0)       // meal_received_qty
    );

    const result = await dbRun(sql, args);
    const newId = useMySQL ? result?.insertId : sqliteId;

    const row = await dbGet(
      `SELECT id, title, description, location, goal, raised, supporters,
              tags, cover, cover_url, status, created_at, updated_at, deadline, \`type\`,
              target_amount, raised_amount, meal_price, meal_received_qty
       FROM campaigns WHERE id=?`,
      [newId]
    );

    res.status(201).json({ ok: true, ...mapCampaignRow(row) });
  } catch (err) {
    console.error("[POST /api/admin/campaigns] error:", err);
    res.status(500).json({ ok: false, message: "Tạo chiến dịch thất bại" });
  }
});

/* ========================= PATCH /:id (update) ========================= */
router.patch("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const id = req.params.id;
    const cur = await dbGet("SELECT * FROM campaigns WHERE id=?", [id]);
    if (!cur) return res.status(404).json({ ok: false, message: "Not found" });

    const c = { ...cur, ...req.body };
    const metaJson = c.meta != null ? JSON.stringify(c.meta) : buildMetaJson(c);
    const typeForColumn = (c.meta?.type || c.type || "money").toString();

    const sql = `
  UPDATE campaigns SET
    title=?, description=?, location=?,
    goal=?, raised=?, supporters=?,
    tags=?, cover=?, cover_url=?, status=?, deadline=?, \`type\`=?,
    target_amount=?, raised_amount=?, meal_price=?, meal_received_qty=?,
    updated_at=CURRENT_TIMESTAMP
  WHERE id=?`;

    const args = [
      safe(c.title).trim(),
      safe(c.description),
      safe(c.location),
      toNum(c.target_amount ?? c.goal, 0),
      toNum(c.raised_amount ?? c.raised, 0),
      toNum(c.supporters, 0),
      metaJson,
      safe(c.cover_url ?? c.cover),
      safe(c.cover_url ?? c.cover),
      safe(c.status, "draft"),
      c.end_at ?? c.deadline ?? null,
      typeForColumn,
      toNum(c.target_amount ?? c.goal, 0),
      toNum(c.raised_amount ?? c.raised, 0),
      toNum(c.meal_price, 0),
      toNum(c.meal_received_qty ?? parseJson(cur.tags, {})?.meal?.received_qty, 0),
      id,
    ];

    await dbRun(sql, args);

    const row = await dbGet(
      `SELECT id, title, description, location, goal, raised, supporters,
              tags, cover, cover_url, status, created_at, updated_at, deadline, \`type\`,
              target_amount, raised_amount, meal_price, meal_received_qty
       FROM campaigns WHERE id=?`,
      [id]
    );

    res.json({ ok: true, ...mapCampaignRow(row) });
  } catch (err) {
    console.error("[PATCH /api/admin/campaigns/:id] error:", err);
    res.status(500).json({ ok: false, message: "Cập nhật chiến dịch thất bại" });
  }
});

/* ========================= DELETE /:id ========================= */
router.delete("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const id = req.params.id;
    await dbRun("DELETE FROM campaigns WHERE id=?", [id]);
    res.status(204).end();
  } catch (err) {
    console.error("[DELETE /api/admin/campaigns/:id] error:", err);
    res.status(500).json({ ok: false, message: "Xoá chiến dịch thất bại" });
  }
});

/* ============ POST /:id/donations (manual add) ============ */
router.post("/:id/donations", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const campaign_id = req.params.id;
    const {
      type = "money",
      amount = 0,
      qty = 0,
      currency = "VND",
      donor_name = "",
      donor_note = "",
      memo = "",
      paid_at = null,
      bank_txn_id = null,
    } = req.body || {};

    if (bank_txn_id) {
      const sql = useMySQL
        ? `INSERT IGNORE INTO donations
             (campaign_id, type, amount, qty, currency, donor_name, donor_note, memo, status, paid_at, bank_txn_id, created_at)
           VALUES (?,?,?,?,?,?,?,?, 'success', ?, ?, CURRENT_TIMESTAMP)`
        : `INSERT OR IGNORE INTO donations
             (campaign_id, type, amount, qty, currency, donor_name, donor_note, memo, status, paid_at, bank_txn_id, created_at)
           VALUES (?,?,?,?,?,?,?,?, 'success', ?, ?, datetime('now'))`;
      await dbRun(sql, [
        campaign_id,
        type,
        toNum(amount, 0),
        toNum(qty, 0),
        currency,
        donor_name,
        donor_note,
        memo,
        paid_at,
        bank_txn_id,
      ]);
    } else {
      const sql = `INSERT INTO donations
         (campaign_id, type, amount, qty, currency, donor_name, donor_note, memo, status, paid_at, created_at)
       VALUES (?,?,?,?,?,?,?,?, 'success', ?, ${useMySQL ? "CURRENT_TIMESTAMP" : "datetime('now')"})`;
      await dbRun(sql, [
        campaign_id,
        type,
        toNum(amount, 0),
        toNum(qty, 0),
        currency,
        donor_name,
        donor_note,
        memo,
        paid_at,
      ]);
    }

    await applyDonationToCampaign({ campaign_id, type, amount, qty });
    return res.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/admin/campaigns/:id/donations] error:", err);
    res.status(500).json({ ok: false, message: "Thêm ủng hộ thất bại" });
  }
});

/* ============ POST /:id/recalc ============ */
router.post("/:id/recalc", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const id = req.params.id;
    await recalcCampaignFromDonations(id);
    const row = await dbGet(
      `SELECT id, title, description, location, goal, raised, supporters,
              tags, cover, cover_url, status, created_at, updated_at, deadline, \`type\`,
              target_amount, raised_amount, meal_price, meal_received_qty
       FROM campaigns WHERE id=?`,
      [id]
    );
    res.json({ ok: true, ...mapCampaignRow(row) });
  } catch (err) {
    console.error("[POST /api/admin/campaigns/:id/recalc] error:", err);
    res.status(500).json({ ok: false, message: "Không recalc được chiến dịch" });
  }
});

export default router;
