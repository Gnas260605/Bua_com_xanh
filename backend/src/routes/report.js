// src/routes/reports.js
// Reports API (campaigns list + detail) — khớp front-end Reports.jsx
// - Dùng MySQL pool (../db phải export { pool })
// - Tối ưu: placeholder an toàn, sort hợp lệ, phân trang, convert số

const express = require("express");
const router = express.Router();
const { pool } = require("../db");

// Các trạng thái donation được coi là đã thanh toán/thành công
const PAID_STATUSES = ["paid", "succeeded", "success", "completed", "confirmed"];
const paidPH = () => PAID_STATUSES.map(() => "?").join(",");

// Helpers
const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const pageSizeBounds = (x) => clamp(x, 1, 50);

// Whitelist sort keys để tránh SQL injection ở ORDER BY
function getOrderBy(sort) {
  switch ((sort || "progress").toLowerCase()) {
    case "raised":
      return "money_raised DESC";
    case "supporters":
      return "supporters DESC";
    case "newest":
      return "c.created_at DESC";
    case "progress":
    default:
      // Tiến độ = money_raised / goal (NULLIF để tránh /0)
      return "(money_raised / NULLIF(c.goal,0)) DESC";
  }
}

/* ================= LIST ================= */
router.get("/campaigns", async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page || "1", 10));
  const pageSize = pageSizeBounds(parseInt(req.query.pageSize || "20", 10));
  const q = (req.query.q || "").trim();
  const status = (req.query.status || "all").toLowerCase();
  const sort = (req.query.sort || "progress").toLowerCase();
  const year = req.query.year && req.query.year !== "all" ? parseInt(req.query.year, 10) : null;

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
  if (year) {
    where.push("YEAR(c.created_at) = ?");
    params.push(year);
  }

  const whereSQL = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const offset = (page - 1) * pageSize;
  const ORDER_BY = getOrderBy(sort);

  try {
    const conn = await pool.getConnection();
    try {
      // Đếm tổng số campaigns thỏa điều kiện WHERE
      const [countRows] = await conn.query(
        `SELECT COUNT(*) AS total FROM campaigns c ${whereSQL}`,
        params
      );
      const total = toNum(countRows?.[0]?.total);

      // Danh sách + số liệu tổng hợp (money_raised / meals_raised / supporters)
      // LƯU Ý: có 3 lần dùng IN (${paidPH()}), nên cần truyền PAID_STATUSES 3 lần.
      const sql = `
        SELECT
          c.id, c.title, c.location, c.description, c.type,
          LOWER(c.status) AS status,
          c.goal, c.meal_price, c.meal_received_qty,
          c.cover, c.cover_url, c.created_at,
          COALESCE(SUM(CASE WHEN d.status IN (${paidPH()}) THEN d.amount ELSE 0 END),0)  AS money_raised,
          COALESCE(SUM(CASE WHEN d.status IN (${paidPH()}) THEN d.quantity ELSE 0 END),0) AS meals_raised,
          COUNT(DISTINCT CASE WHEN d.status IN (${paidPH()}) THEN d.user_id END)        AS supporters
        FROM campaigns c
        LEFT JOIN donations d ON d.campaign_id = c.id
        ${whereSQL}
        GROUP BY c.id
        ORDER BY ${ORDER_BY}
        LIMIT ? OFFSET ?
      `;

      const dataParams = [
        ...params,
        ...PAID_STATUSES, // for money_raised
        ...PAID_STATUSES, // for meals_raised
        ...PAID_STATUSES, // for supporters
        pageSize,
        offset,
      ];

      const [rows] = await conn.query(sql, dataParams);

      const items = rows.map((r) => {
        const goal = toNum(r.goal);
        const mealPrice = toNum(r.meal_price);
        const mealGoal =
          goal > 0 && mealPrice > 0
            ? Math.floor(goal / mealPrice)
            : toNum(r.meal_goal);

        return {
          id: r.id,
          title: r.title,
          location: r.location,
          description: r.description,
          status: r.status,
          type: r.type,
          goal,
          money_goal: goal, // FE dùng money_goal, đã map = goal
          money_raised: toNum(r.money_raised),
          meal_price: mealPrice,
          meal_goal: mealGoal,
          meals_raised: toNum(r.meals_raised || r.meal_received_qty),
          supporters: toNum(r.supporters),
          cover: r.cover || r.cover_url || null,
          created_at: r.created_at,
        };
      });

      res.json({ page, pageSize, total, items });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error("GET /reports/campaigns error:", e);
    res.status(500).json({ ok: false, message: "Server error" });
  }
});

/* ================= DETAIL ================= */
router.get("/campaigns/:id", async (req, res) => {
  const id = req.params.id;

  try {
    const conn = await pool.getConnection();
    try {
      // Lấy thông tin campaign
      const [rows] = await conn.query(
        `SELECT * FROM campaigns WHERE id = ? LIMIT 1`,
        [id]
      );
      const c = rows?.[0];
      if (!c) return res.status(404).json({ ok: false, message: "Not found" });

      // Tổng hợp số liệu (tiền, bữa, supporters)
      const [agg] = await conn.query(
        `
        SELECT
          COALESCE(SUM(CASE WHEN status IN (${paidPH()}) THEN amount   ELSE 0 END),0) AS money,
          COALESCE(SUM(CASE WHEN status IN (${paidPH()}) THEN quantity ELSE 0 END),0) AS meals,
          COUNT(DISTINCT CASE WHEN status IN (${paidPH()}) THEN user_id END)         AS supporters
        FROM donations
        WHERE campaign_id = ?
        `,
        [...PAID_STATUSES, ...PAID_STATUSES, ...PAID_STATUSES, id]
      );
      const aggRow = agg?.[0] || {};

      // Series theo tháng (dựa paid_at nếu có, fallback created_at)
      const [series] = await conn.query(
        `
        SELECT
          DATE_FORMAT(COALESCE(paid_at, created_at), '%Y-%m') AS ym,
          SUM(CASE WHEN status IN (${paidPH()}) THEN amount   ELSE 0 END) AS value,
          SUM(CASE WHEN status IN (${paidPH()}) THEN quantity ELSE 0 END) AS meals,
          COUNT(CASE WHEN status IN (${paidPH()}) THEN 1 END)             AS donations
        FROM donations
        WHERE campaign_id = ?
        GROUP BY ym
        ORDER BY ym
        `,
        [...PAID_STATUSES, ...PAID_STATUSES, ...PAID_STATUSES, id]
      );

      // 10 donation gần nhất
      const [latest] = await conn.query(
        `
        SELECT d.id, d.amount, d.quantity, d.created_at AS at, u.name AS donor
        FROM donations d
        LEFT JOIN users u ON u.id = d.user_id
        WHERE d.campaign_id = ? AND d.status IN (${paidPH()})
        ORDER BY d.created_at DESC
        LIMIT 10
        `,
        [id, ...PAID_STATUSES]
      );

      const goal = toNum(c.goal);
      const mealPrice = toNum(c.meal_price);
      const mealGoal =
        goal > 0 && mealPrice > 0 ? Math.floor(goal / mealPrice) : 0;

      res.json({
        item: {
          id: c.id,
          title: c.title,
          description: c.description,
          location: c.location,
          status: c.status,
          type: c.type,
          goal,
          money_goal: goal,
          money_raised: toNum(aggRow.money),
          meal_price: mealPrice,
          meal_goal: mealGoal,
          meals_raised: toNum(aggRow.meals || c.meal_received_qty),
          supporters: toNum(aggRow.supporters),
          cover: c.cover || c.cover_url || null,
          created_at: c.created_at,
        },
        series: series.map((r) => ({
          month: r.ym,
          value: toNum(r.value),
          meals: toNum(r.meals),
          donations: toNum(r.donations),
        })),
        latest: latest.map((d) => ({
          id: d.id,
          amount: toNum(d.amount),
          meals: toNum(d.quantity),
          at: d.at,
          donor: d.donor,
        })),
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error("GET /reports/campaigns/:id error:", e);
    res.status(500).json({ ok: false, message: "Server error" });
  }
});

module.exports = router;
