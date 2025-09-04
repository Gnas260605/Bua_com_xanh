import mysql from "mysql2/promise";
import "dotenv/config";

export const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || "127.0.0.1",
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "",
  database: process.env.MYSQL_DATABASE || "bua_com_xanh",
  connectionLimit: 10,
});

export const db = {
  all: async (sql, params = []) => {
    const [rows] = await pool.query(sql, params);
    return rows;
  },
  get: async (sql, params = []) => {
    const [rows] = await pool.query(sql, params);
    return rows[0] || null;
  },
  run: async (sql, params = []) => {
    const [ret] = await pool.query(sql, params);
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
};
