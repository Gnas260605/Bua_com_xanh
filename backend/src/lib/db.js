import "dotenv/config";

let db, migrate;

if ((process.env.DB_DRIVER || "sqlite") === "mysql") {
  const m = await import("./db.mysql.js");
  db = m.db;
  migrate = async () => {}; // MySQL: import schema thủ công qua phpMyAdmin
} else {
  const m = await import("./db.sqlite.js");
  db = m.db;
  migrate = m.migrate;
}

export { db, migrate };
// Kết nối MySQL dùng mysql2/promise
const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASS || "",
  database: process.env.DB_NAME || "buacomxanh",
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: false,
});

module.exports = { pool };
