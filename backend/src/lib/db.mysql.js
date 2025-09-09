import mysql from "mysql2/promise";
import "dotenv/config";

const host = process.env.MYSQL_HOST || process.env.DB_HOST || "127.0.0.1";
const port = Number(process.env.MYSQL_PORT || process.env.DB_PORT || 3306);
const user = process.env.MYSQL_USER || process.env.DB_USER || "root";
const password = process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD || "";
const database =
  process.env.MYSQL_DATABASE || process.env.DB_NAME || "bua_com_xanh";

export const pool = mysql.createPool({
  host, port, user, password, database,
  connectionLimit: 10,
  dateStrings: true,
  timezone: "Z",
});

console.log(`[DB] using MySQL ${user}@${host}:${port}/${database}`);
try {
  await pool.query("SELECT 1");
  console.log("[DB] MySQL connected OK");
} catch (e) {
  console.error("[DB] MySQL connect error:", e.code || e.message);
  throw e;
}

async function query(sql, params = []) { return pool.query(sql, params); }

export const db = {
  all: async (sql, params = []) => { const [rows] = await query(sql, params); return rows; },
  get: async (sql, params = []) => { const [rows] = await query(sql, params); return rows?.[0] ?? null; },
  run: async (sql, params = []) => { const [ret]  = await query(sql, params); return ret; },
  prepare: (sql) => ({
    all: (p = []) => db.all(sql, p),
    get: (p = []) => db.get(sql, p),
    run: (p = {}) => {
      if (Array.isArray(p)) return db.run(sql, p);
      if (p && typeof p === "object") return db.run(sql, Object.values(p));
      return db.run(sql, [p]);
    },
  }),
  query, pool,
};
export default db;
