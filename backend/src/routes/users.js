import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import "dotenv/config";

const useMySQL = (process.env.DB_DRIVER || "sqlite") === "mysql";
let db;
if (useMySQL) { ({ db } = await import("../lib/db.mysql.js")); }
else          { ({ db } = await import("../lib/db.js")); }

const router = Router();

router.get("/me", requireAuth, async (req, res) => {
  const row = useMySQL
    ? await db.get("SELECT id,email,name,avatar_url,role,address,phone,status FROM users WHERE id=?", [req.user.id])
    : db.prepare("SELECT id,email,name,avatar_url,role,address,phone,status FROM users WHERE id=?").get(req.user.id);
  return res.json(row || null);
});

router.patch("/me", requireAuth, async (req, res) => {
  const { name="", address="", avatar_url="" } = req.body || {};
  const sql = `UPDATE users SET name=?, address=?, avatar_url=? WHERE id=?`;
  if (useMySQL) await db.run(sql, [name, address, avatar_url, req.user.id]);
  else db.prepare(sql).run(name, address, avatar_url, req.user.id);
  const row = useMySQL
    ? await db.get("SELECT id,email,name,avatar_url,role,address,phone,status FROM users WHERE id=?", [req.user.id])
    : db.prepare("SELECT id,email,name,avatar_url,role,address,phone,status FROM users WHERE id=?").get(req.user.id);
  return res.json(row);
});

export default router;
