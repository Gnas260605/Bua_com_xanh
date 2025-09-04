import { Router } from "express";
import "dotenv/config";

const useMySQL = (process.env.DB_DRIVER || "sqlite") === "mysql";
let db;
if (useMySQL) { ({ db } = await import("../lib/db.mysql.js")); }
else          { ({ db } = await import("../lib/db.js")); }

function listByRole(role) {
  return async (_req, res) => {
    const sql = "SELECT id,name,email,avatar_url,address,status FROM users WHERE role=? ORDER BY created_at DESC";
    const rows = useMySQL ? await db.all(sql, [role]) : db.prepare(sql).all(role);
    res.json(rows);
  };
}

const donors = Router().get("/", listByRole("donor"));
export default donors;
