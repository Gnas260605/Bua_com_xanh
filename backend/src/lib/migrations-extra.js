import "dotenv/config";

const useMySQL = (process.env.DB_DRIVER || "sqlite") === "mysql";

// Nạp DB theo driver
let db;
if (useMySQL) {
  ({ db } = await import("./db.mysql.js"));
} else {
  ({ db } = await import("./db.js"));
}

export async function ensureAddressColumn() {
  try {
    if (useMySQL) {
      // MySQL: kiểm tra tồn tại cột qua INFORMATION_SCHEMA
      const col = await db.get(
        `SELECT COLUMN_NAME
           FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'users'
            AND COLUMN_NAME = 'address'`
      );
      if (!col) {
        await db.run(`ALTER TABLE users ADD COLUMN address VARCHAR(255) NULL AFTER role`);
        console.log("[migrate] users.address added (MySQL)");
      }
    } else {
      // SQLite: PRAGMA table_info
      const cols = db.prepare(`PRAGMA table_info(users)`).all();
      const has = cols.some((c) => c.name === "address");
      if (!has) {
        db.prepare(`ALTER TABLE users ADD COLUMN address TEXT`).run();
        console.log("[migrate] users.address added (SQLite)");
      }
    }
  } catch (e) {
    // Bỏ qua lỗi cột đã tồn tại / không làm server sập
    if (useMySQL && e.code === "ER_DUP_FIELDNAME") return;
    console.warn("[migrate] ensureAddressColumn warning:", e.message);
  }
}
