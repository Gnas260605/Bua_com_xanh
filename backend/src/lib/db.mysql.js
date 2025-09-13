// src/lib/db.mysql.js (hoặc đường dẫn bạn đang dùng)
import mysql from "mysql2/promise";
import "dotenv/config";

const url = process.env.DATABASE_URL; // tùy chọn, nếu bạn dùng 1 biến URL
let cfg = {};

if (url) {
  // Tip: mysql2 không parse URL trực tiếp; vẫn nên tách biến riêng.
  // Bạn có thể dùng thư viện whatwg URL nếu muốn parse.
  const u = new URL(url);
  cfg = {
    host: u.hostname,
    port: Number(u.port || 3306),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ""),
  };
} else {
  cfg = {
    host: process.env.MYSQL_HOST || process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.MYSQL_PORT || process.env.DB_PORT || 3306),
    user: process.env.MYSQL_USER || process.env.DB_USER || "root",
    password: process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD || "",
    database: process.env.MYSQL_DATABASE || process.env.DB_NAME || "bua_com_xanh",
  };
}

const NEED_SSL = String(process.env.MYSQL_SSL || process.env.DB_SSL || "")
  .toLowerCase()
  .trim();

const ssl =
  NEED_SSL === "1" || NEED_SSL === "true"
    ? { rejectUnauthorized: true, minVersion: "TLSv1.2" }
    : undefined;

export const pool = mysql.createPool({
  ...cfg,
  ssl,
  waitForConnections: true,
  connectionLimit: Number(process.env.MYSQL_POOL || 10),
  dateStrings: true,
  timezone: "Z",
});

console.log(
  `[DB] using MySQL ${cfg.user}@${cfg.host}:${cfg.port}/${cfg.database} SSL=${!!ssl}`
);

// nhẹ nhàng retry để chờ DB sẵn sàng (cold start, network)
async function pingWithRetry(max = 5) {
  let lastErr;
  for (let i = 1; i <= max; i++) {
    try {
      await pool.query("SELECT 1");
      console.log("[DB] MySQL connected OK");
      return;
    } catch (e) {
      lastErr = e;
      console.warn(`[DB] Connect attempt ${i}/${max} failed: ${e.code || e.message}`);
      await new Promise((r) => setTimeout(r, i * 500)); // backoff
    }
  }
  console.error("[DB] MySQL connect error:", lastErr?.code || lastErr?.message);
  throw lastErr;
}
await pingWithRetry();

async function query(sql, params = []) {
  return pool.query(sql, params);
}

export const db = {
  all: async (sql, params = []) => {
    const [rows] = await query(sql, params);
    return rows;
  },
  get: async (sql, params = []) => {
    const [rows] = await query(sql, params);
    return rows?.[0] ?? null;
  },
  run: async (sql, params = []) => {
    const [ret] = await query(sql, params);
    return ret;
  },
  prepare: (sql) => ({
    all: (p = []) => db.all(sql, p),
    get: (p = []) => db.get(sql, p),
    run: (p = {}) => {
      if (Array.isArray(p)) return db.run(sql, p);
      if (p && typeof p === "object") return db.run(sql, Object.values(p));
      return db.run(sql, [p]);
    },
  }),
  query,
  pool,
};

export default db;
