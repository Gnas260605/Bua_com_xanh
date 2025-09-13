import "dotenv/config";

const useMySQL = (process.env.DB_DRIVER || "sqlite") === "mysql";
let db;
if (useMySQL) { ({ db } = await import("./db.mysql.js")); }
else          { ({ db } = await import("./db.js")); }

/** Gọi ở server.js. Nếu không dùng MySQL thì noop. */
export async function ensureMySQLSchema() {
  if (!useMySQL) return;

  // users
  await db.run(`CREATE TABLE IF NOT EXISTS users(
    id CHAR(36) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(30),
    avatar_url VARCHAR(500),
    role ENUM('user','donor','receiver','shipper','admin') NOT NULL DEFAULT 'user',
    address VARCHAR(255),
    status ENUM('active','banned','deleted') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);

  // otp_codes
  await db.run(`CREATE TABLE IF NOT EXISTS otp_codes(
    id CHAR(36) PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    code VARCHAR(10) NOT NULL,
    purpose VARCHAR(50) NOT NULL,
    expires_at DATETIME NOT NULL,
    used_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX(email), INDEX(purpose)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);

  // campaigns
  await db.run(`CREATE TABLE IF NOT EXISTS campaigns(
    id CHAR(36) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    location VARCHAR(255),
    goal INT NOT NULL DEFAULT 0,
    raised INT NOT NULL DEFAULT 0,
    supporters INT NOT NULL DEFAULT 0,
    tags JSON,
    cover VARCHAR(500),
    status ENUM('active','closed') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);

  // food_items (bữa cơm)
  await db.run(`CREATE TABLE IF NOT EXISTS food_items(
    id CHAR(36) PRIMARY KEY,
    owner_id CHAR(36) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    qty INT NOT NULL DEFAULT 0,
    unit VARCHAR(20),
    expire_at DATETIME NOT NULL,
    location_addr VARCHAR(255),
    lat DOUBLE NULL,
    lng DOUBLE NULL,
    tags JSON,
    images JSON,
    status ENUM('available','reserved','done','cancelled') NOT NULL DEFAULT 'available',
    visibility ENUM('public','private') NOT NULL DEFAULT 'public',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    INDEX(owner_id), INDEX(status), INDEX(expire_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);

  // metrics_daily
  await db.run(`CREATE TABLE IF NOT EXISTS metrics_daily(
    day DATE PRIMARY KEY,
    users INT NOT NULL DEFAULT 0,
    donors INT NOT NULL DEFAULT 0,
    recipients INT NOT NULL DEFAULT 0,
    shippers INT NOT NULL DEFAULT 0,
    campaigns INT NOT NULL DEFAULT 0,
    items INT NOT NULL DEFAULT 0,
    bookings INT NOT NULL DEFAULT 0,
    deliveries INT NOT NULL DEFAULT 0,
    rescued_meals INT NOT NULL DEFAULT 0,
    fee_revenue INT NOT NULL DEFAULT 0
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);

  
}
