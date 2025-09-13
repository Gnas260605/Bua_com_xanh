// backend/src/routes/meals.js
import { Router } from "express";
import "dotenv/config";
const useMySQL = (process.env.DB_DRIVER || "sqlite") === "mysql";
let db;
if (useMySQL) ({ db } = await import("../lib/db.mysql.js"));
else ({ db } = await import("../lib/db.js"));

const router = Router();

async function dbRun(sql, params = []) {
  if (useMySQL) { const [ret] = await db.query(sql, params); return ret; }
  return db.prepare(sql).run(...params);
}
function nowSQL() { return new Date().toISOString().slice(0,19).replace("T"," "); }
const toNum = (v,d=0)=>Number.isFinite(Number(v))?Number(v):d;

router.post("/donate", async (req, res) => {
  try {
    const campaign_id = req.body?.campaign_id;
    const servings = toNum(req.body?.servings, 0);
    const pickup_point_id = req.body?.pickup_point_id ?? null;
    const user_location = req.body?.user_location || null;
    if (!campaign_id || servings<=0) {
      return res.status(400).json({ ok:false, message:"Thiếu campaign_id hoặc servings không hợp lệ" });
    }
    await dbRun(
      `INSERT INTO donations (campaign_id, type, amount, qty, currency, donor_name, donor_note, memo, status, paid_at, created_at)
       VALUES (?, 'meal', 0, ?, 'VND', NULL, NULL, ?, 'success', ?, ?)`,
      [campaign_id, servings, pickup_point_id ? `pickup_point:${pickup_point_id}` : null, nowSQL(), nowSQL()]
    ).catch(()=>null);
    await dbRun(`UPDATE campaigns SET meals=COALESCE(meals,0)+? WHERE id=?`, [servings, campaign_id]).catch(()=>null);
    if (user_location?.lat!=null && user_location?.lng!=null) {
      await dbRun(
        `INSERT INTO audit_logs (actor, action, entity, entity_id, details, created_at)
         VALUES ('public', 'meal_donate', 'campaign', ?, ?, ?)`,
        [campaign_id, JSON.stringify({ pickup_point_id, user_location }), nowSQL()]
      ).catch(()=>null);
    }
    return res.json({ ok:true });
  } catch (e) {
    console.error("[meals/donate] ", e);
    return res.status(500).json({ ok:false, message:"Không ghi nhận được ủng hộ bữa ăn" });
  }
});

export default router;
