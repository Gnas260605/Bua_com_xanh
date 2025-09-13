import { Router } from "express";
import "dotenv/config";
const useMySQL = (process.env.DB_DRIVER || "sqlite") === "mysql";
let db;
if (useMySQL) { ({ db } = await import("../lib/db.mysql.js")); }
else          { ({ db } = await import("../lib/db.js")); }

const router = Router();
router.get("/", async (_req, res) => {
  const sql = "SELECT id,name,email,avatar_url,address,status FROM users WHERE role='receiver' ORDER BY created_at DESC";
  const rows = useMySQL ? await db.all(sql) : db.prepare(sql).all();
  res.json(rows);
});
export default router;
