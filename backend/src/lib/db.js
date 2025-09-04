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
