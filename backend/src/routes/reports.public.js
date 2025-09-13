import { Router } from "express";
import "dotenv/config";

const useMySQL = (process.env.DB_DRIVER || "sqlite") === "mysql";
let db;
if (useMySQL) ({ db } = await import("../lib/db.mysql.js"));
else ({ db } = await import("../lib/db.js"));

const router = Router();
const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));
const toNum = (v,d=0)=> (Number.isFinite(Number(v)) ? Number(v) : d);
const parseJson = (raw,fb={})=>{ try{ return raw ? (typeof raw==="string"?JSON.parse(raw):raw) : fb; }catch{ return fb; } };

async function dbGet(sql,params=[]){
  if (useMySQL){ const [rows] = await db.query(sql,params); return rows?.[0]??null; }
  return db.prepare(sql).get(...params);
}
async function dbAll(sql,params=[]){
  if (useMySQL){ const [rows] = await db.query(sql,params); return rows??[]; }
  return db.prepare(sql).all(...params);
}
function mapRow(r){
  const meta = parseJson(r.tags, {});
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    location: r.location,
    status: r.status,
    goal: toNum(r.goal, 0),
    // ưu tiên số liệu tính từ donations; fallback cột trong campaigns nếu có
    raised_amount: toNum(r.agg_raised ?? r.raised_amount ?? r.raised ?? 0, 0),
    supporters: toNum(r.agg_supporters ?? r.supporters ?? 0, 0),
    cover_url: r.cover || r.cover_url || "",
    created_at: r.created_at,
    updated_at: r.updated_at,
    deadline: r.deadline,
    type: r.type || meta?.type || "money",
  };
}

/* ========== GET /api/reports/campaigns ========== */
router.get("/campaigns", async (req, res) => {
  const q = String(req.query.q || "").trim();
  const status = (req.query.status || "all").toLowerCase();
  const sort = (req.query.sort || "progress").toLowerCase();
  const page = clamp(parseInt(req.query.page) || 1, 1, 1e9);
  const pageSize = clamp(parseInt(req.query.pageSize) || 30, 1, 100);
  const offset = (page - 1) * pageSize;

  const where = [];
  const params = [];
  if (q){
    where.push("(c.title LIKE ? OR c.location LIKE ? OR c.description LIKE ?)");
    params.push(`%${q}%`,`%${q}%`,`%${q}%`);
  }
  if (status !== "all"){
    where.push("LOWER(c.status)=?");
    params.push(status);
  }
  const whereSQL = where.length ? `WHERE ${where.join(" AND ")}` : "";

  // subquery tổng hợp donations theo campaign_id
  const aggSQL = `
    SELECT campaign_id,
           COALESCE(SUM(CASE WHEN status='success' AND type='money' THEN amount ELSE 0 END),0) AS agg_raised,
           COALESCE(COUNT(CASE WHEN status='success' THEN 1 END),0) AS agg_supporters
    FROM donations
    GROUP BY campaign_id
  `;

  const totalRow = await dbGet(`SELECT COUNT(*) AS total FROM campaigns c ${whereSQL}`, params);

  // sắp xếp
  let orderSQL = "c.created_at DESC";
  if (sort === "raised") orderSQL = "COALESCE(a.agg_raised,0) DESC, c.created_at DESC";
  else if (sort === "supporters") orderSQL = "COALESCE(a.agg_supporters,0) DESC, c.created_at DESC";
  else if (sort === "progress") orderSQL = "(COALESCE(a.agg_raised,0) / NULLIF(c.goal,0)) DESC, c.created_at DESC";

  const rows = await dbAll(
    `
    SELECT c.id, c.title, c.description, c.location, c.status, c.goal, c.cover, c.cover_url,
           c.created_at, c.updated_at, c.deadline, c.type, c.tags,
           a.agg_raised, a.agg_supporters,
           c.raised AS raised, c.raised_amount AS raised_amount, c.supporters AS supporters
    FROM campaigns c
    LEFT JOIN ( ${aggSQL} ) a ON a.campaign_id = c.id
    ${whereSQL}
    ORDER BY ${orderSQL}
    LIMIT ? OFFSET ?
    `,
    [...params, pageSize, offset]
  );

  res.json({
    ok: true,
    total: toNum(totalRow?.total, 0),
    items: rows.map(mapRow),
    page, pageSize
  });
});

/* ========== GET /api/reports/campaigns/:id (chi tiết + series) ========== */
router.get("/campaigns/:id", async (req, res) => {
  const id = req.params.id;

  const item = await dbGet(
    `
    SELECT c.id, c.title, c.description, c.location, c.status, c.goal, c.cover, c.cover_url,
           c.created_at, c.updated_at, c.deadline, c.type, c.tags,
           a.agg_raised, a.agg_supporters,
           c.raised AS raised, c.raised_amount AS raised_amount, c.supporters AS supporters
    FROM campaigns c
    LEFT JOIN (
      SELECT campaign_id,
             COALESCE(SUM(CASE WHEN status='success' AND type='money' THEN amount ELSE 0 END),0) AS agg_raised,
             COALESCE(COUNT(CASE WHEN status='success' THEN 1 END),0) AS agg_supporters
      FROM donations
      WHERE campaign_id = ?
      GROUP BY campaign_id
    ) a ON a.campaign_id = c.id
    WHERE c.id = ?
    `,
    [id, id]
  );
  if (!item) return res.status(404).json({ ok:false, message:"Not found" });

  const monthExpr = useMySQL
    ? "DATE_FORMAT(COALESCE(d.paid_at,d.created_at),'%Y-%m')"
    : "strftime('%Y-%m', COALESCE(d.paid_at,d.created_at))";

  const series = await dbAll(
    `
    SELECT ${monthExpr} AS month,
           SUM(CASE WHEN d.status='success' AND d.type='money' THEN d.amount ELSE 0 END) AS value,
           COUNT(CASE WHEN d.status='success' THEN 1 END) AS donations
    FROM donations d
    WHERE d.campaign_id = ?
    GROUP BY month
    ORDER BY month
    `,
    [id]
  );

  res.json({
    ok:true,
    item: mapRow(item),
    series: series.map(r => ({ month: r.month, value: toNum(r.value,0), donations: toNum(r.donations,0) }))
  });
});

export default router;
