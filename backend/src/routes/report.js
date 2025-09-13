const express = require("express");
const router = express.Router();
const { pool } = require("../db");

// Các trạng thái donation coi là đã thanh toán
const PAID_STATUSES = ["paid", "succeeded", "success", "completed", "confirmed"];

/** build "IN (?, ?, ...)" cho mysql2 */
function inPlaceholders(arr) {
  return arr.map(() => "?").join(",");
}

/** GET /api/admin/campaigns
 *  Query:
 *   - page=1&pageSize=50
 *   - q=keyword
 *   - status=all|active|closed|draft (so sánh lowercase)
 *   - sort=progress|raised|supporters|newest
 */
router.get("/campaigns", async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page || "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize || "20", 10)));
  const q = (req.query.q || "").trim();
  const status = (req.query.status || "all").toLowerCase();
  const sort = (req.query.sort || "progress").toLowerCase();

  const paidPH = inPlaceholders(PAID_STATUSES);

  const where = [];
  const params = [];

  if (status !== "all") {
    where.push("LOWER(c.status) = ?");
    params.push(status);
  }
  if (q) {
    where.push("(c.title LIKE ? OR c.location LIKE ? OR c.description LIKE ?)");
    const kw = `%${q}%`;
    params.push(kw, kw, kw);
  }
  const whereSQL = where.length ? `WHERE ${where.join(" AND ")}` : "";

  // sort expression
  const sumExpr = `COALESCE(SUM(CASE WHEN d.status IN (${paidPH}) THEN d.amount ELSE 0 END),0)`;
  const supportersExpr = `COUNT(DISTINCT CASE WHEN d.status IN (${paidPH}) THEN d.user_id END)`;
  let orderSQL = "";
  if (sort === "raised") orderSQL = `${sumExpr} DESC`;
  else if (sort === "supporters") orderSQL = `${supportersExpr} DESC`;
  else if (sort === "newest") orderSQL = `c.created_at DESC`;
  else {
    // progress
    orderSQL = `(${sumExpr} / NULLIF(c.goal,0)) DESC`;
  }

  const offset = (page - 1) * pageSize;

  try {
    const conn = await pool.getConnection();
    try {
      // total campaigns thỏa filter (không join donations để nhanh)
      const [countRows] = await conn.query(
        `SELECT COUNT(*) AS total FROM campaigns c ${whereSQL}`,
        params
      );
      const total = countRows[0]?.total || 0;

      // data + aggregate
      const sql = `
        SELECT
          c.id,
          c.title,
          c.location,
          c.description,
          LOWER(c.status) AS status,
          c.goal,
          c.created_at,
          ${sumExpr} AS raised_amount,
          ${supportersExpr} AS supporters
        FROM campaigns c
        LEFT JOIN donations d ON d.campaign_id = c.id
        ${whereSQL}
        GROUP BY c.id
        ORDER BY ${orderSQL}
        LIMIT ? OFFSET ?
      `;
      const dataParams = [...params, ...PAID_STATUSES, ...PAID_STATUSES, pageSize, offset];
      // Lưu ý: sumExpr & supportersExpr mỗi cái có (${paidPH}) => cần đẩy PAID_STATUSES 2 lần

      const [rows] = await conn.query(sql, dataParams);

      res.json({
        page,
        pageSize,
        total,
        items: rows.map((r) => ({
          id: r.id,
          title: r.title,
          location: r.location,
          description: r.description,
          status: r.status || "active",
          goal: Number(r.goal || 0),
          raised_amount: Number(r.raised_amount || 0),
          supporters: Number(r.supporters || 0),
          created_at: r.created_at,
        })),
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error("GET /admin/campaigns error:", e);
    res.status(500).json({ ok: false, message: "Server error" });
  }
});

/** GET /api/admin/campaigns/:id/report
 *  - trả tổng quan + time-series theo tháng để vẽ chart
 */
router.get("/campaigns/:id/report", async (req, res) => {
  const id = req.params.id;
  const paidPH = inPlaceholders(PAID_STATUSES);

  try {
    const conn = await pool.getConnection();
    try {
      const [summaryRows] = await conn.query(
        `
        SELECT
          c.id, c.title, c.location, c.description, LOWER(c.status) AS status, c.goal, c.created_at,
          COALESCE(SUM(CASE WHEN d.status IN (${paidPH}) THEN d.amount ELSE 0 END),0) AS raised_amount,
          COUNT(DISTINCT CASE WHEN d.status IN (${paidPH}) THEN d.user_id END) AS supporters
        FROM campaigns c
        LEFT JOIN donations d ON d.campaign_id = c.id
        WHERE c.id = ?
      `,
        [...PAID_STATUSES, ...PAID_STATUSES, id]
      );

      const item = summaryRows[0];
      if (!item) return res.status(404).json({ ok: false, message: "Not found" });

      const [series] = await conn.query(
        `
        SELECT
          DATE_FORMAT(COALESCE(d.paid_at, d.created_at), '%Y-%m') AS ym,
          SUM(CASE WHEN d.status IN (${paidPH}) THEN d.amount ELSE 0 END) AS total,
          COUNT(CASE WHEN d.status IN (${paidPH}) THEN 1 END) AS donations
        FROM donations d
        WHERE d.campaign_id = ?
        GROUP BY ym
        ORDER BY ym
      `,
        [...PAID_STATUSES, ...PAID_STATUSES, id]
      );

      res.json({
        item: {
          id: item.id,
          title: item.title,
          location: item.location,
          description: item.description,
          status: item.status || "active",
          goal: Number(item.goal || 0),
          raised_amount: Number(item.raised_amount || 0),
          supporters: Number(item.supporters || 0),
          created_at: item.created_at,
        },
        series: series.map((r) => ({
          month: r.ym,
          value: Number(r.total || 0),
          donations: Number(r.donations || 0),
        })),
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error("GET /admin/campaigns/:id/report error:", e);
    res.status(500).json({ ok: false, message: "Server error" });
  }
});

module.exports = router;
