// src/lib/ensure-mysql.js
import "dotenv/config";

const useMySQL = (process.env.DB_DRIVER || "sqlite") === "mysql";
let db;
if (useMySQL) {
  ({ db } = await import("./db.mysql.js"));
} else {
  ({ db } = await import("./db.js"));
}

/** Helper: chạy ALTER/Tạo cột… nhưng nuốt lỗi nếu đã tồn tại */
async function safeRun(sql) {
  try {
    return await db.run(sql);
  } catch (e) {
    // Nuốt các lỗi phổ biến khi cột/chỉ mục đã tồn tại hoặc không phù hợp để sửa
    const msg = String(e?.sqlMessage || e?.message || "");
    const ignorable =
      msg.includes("Duplicate column") ||
      msg.includes("check that column/key exists") ||
      msg.includes("Can't DROP") ||
      msg.includes("already exists") ||
      msg.includes("Invalid use of NULL value") ||
      msg.includes("Multiple primary key defined") ||
      msg.includes("Data truncated") ||
      msg.includes("Unknown column") || // đôi khi ALTER chain
      msg.includes("doesn't support dropping primary key") ||
      msg.includes("can't change collation"); // tuỳ bản MySQL
    if (!ignorable) {
      console.warn("[ensure-mysql]", msg);
    }
    return null;
  }
}

/** Gọi ở server.js. Nếu không dùng MySQL thì noop. */
export async function ensureMySQLSchema() {
  if (!useMySQL) return;

  // Một vài thiết lập an toàn
  await safeRun(`SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await safeRun(`SET sql_notes = 0`);

  /* ====================== CORE TABLES ====================== */

  // users
  await db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id CHAR(36) PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      phone VARCHAR(30),
      avatar_url VARCHAR(500),
      role ENUM('user','donor','receiver','shipper','admin') NOT NULL DEFAULT 'user',
      address VARCHAR(255),
      -- toạ độ mặc định cho shipper (dùng làm fallback khi tracking)
      lat DOUBLE NULL,
      lng DOUBLE NULL,
      status ENUM('active','banned','deleted') NOT NULL DEFAULT 'active',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
      INDEX(role), INDEX(status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  await safeRun(`ALTER TABLE users ADD COLUMN lat DOUBLE NULL`);
  await safeRun(`ALTER TABLE users ADD COLUMN lng DOUBLE NULL`);

  // otp_codes
  await db.run(`
    CREATE TABLE IF NOT EXISTS otp_codes (
      id CHAR(36) PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      code VARCHAR(10) NOT NULL,
      purpose VARCHAR(50) NOT NULL,
      expires_at DATETIME NOT NULL,
      used_at DATETIME NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX(email), INDEX(purpose)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // campaigns
  await db.run(`
    CREATE TABLE IF NOT EXISTS campaigns (
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
      updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
      INDEX(status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // food_items (bữa cơm)
  await db.run(`
    CREATE TABLE IF NOT EXISTS food_items (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // metrics_daily
  await db.run(`
    CREATE TABLE IF NOT EXISTS metrics_daily (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  /* ====================== PICKUP POINTS ====================== */

  // điểm tập kết (dùng INT AUTO_INCREMENT)
  await db.run(`
    CREATE TABLE IF NOT EXISTS pickup_points (
      id INT NOT NULL AUTO_INCREMENT,
      name VARCHAR(255) NOT NULL,
      address VARCHAR(255),
      lat DOUBLE NULL,
      lng DOUBLE NULL,
      opening TEXT NULL, -- lưu chuỗi thường hoặc JSON-string
      status ENUM('active','inactive') NOT NULL DEFAULT 'active',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX(status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // vá mềm nếu bảng cũ sai cấu trúc
  await safeRun(`
    ALTER TABLE pickup_points
    MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT
  `);
  await safeRun(`
    ALTER TABLE pickup_points
    ADD COLUMN updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP
  `);

  /* ====================== BOOKINGS / DELIVERIES ====================== */

  // bookings: id số nguyên tự tăng (để khớp với deliveries.booking_id)
  await db.run(`
    CREATE TABLE IF NOT EXISTS bookings (
      id INT NOT NULL AUTO_INCREMENT,
      campaign_id CHAR(36) NULL,
      donor_id CHAR(36) NULL,
      recipient_id CHAR(36) NULL,
      food_item_id CHAR(36) NULL,
      qty INT NOT NULL DEFAULT 1,
      pickup_point_id INT NULL,
      scheduled_at DATETIME NULL,
      status ENUM('pending','confirmed','cancelled','fulfilled') NOT NULL DEFAULT 'pending',
      note TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX(status),
      INDEX(campaign_id),
      INDEX(pickup_point_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // deliveries: booking_id (INT), shipper_id (CHAR(36)) khớp users.id
  await db.run(`
    CREATE TABLE IF NOT EXISTS deliveries (
      id INT NOT NULL AUTO_INCREMENT,
      booking_id INT NOT NULL,
      shipper_id CHAR(36) NULL,
      qty INT NOT NULL DEFAULT 1,
      status ENUM('pending','assigned','picking','delivered','cancelled') NOT NULL DEFAULT 'pending',
      otp_code VARCHAR(10) NULL,
      current_lat DOUBLE NULL,
      current_lng DOUBLE NULL,
      proof_images JSON NULL,
      route_geojson JSON NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX(status),
      INDEX(booking_id),
      INDEX(shipper_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  // vá mềm các cột có thể thiếu
  await safeRun(`ALTER TABLE deliveries ADD COLUMN otp_code VARCHAR(10) NULL`);
  await safeRun(`ALTER TABLE deliveries ADD COLUMN current_lat DOUBLE NULL`);
  await safeRun(`ALTER TABLE deliveries ADD COLUMN current_lng DOUBLE NULL`);
  await safeRun(`ALTER TABLE deliveries ADD COLUMN proof_images JSON NULL`);
  await safeRun(`ALTER TABLE deliveries ADD COLUMN route_geojson JSON NULL`);
  await safeRun(`
    ALTER TABLE deliveries
    MODIFY COLUMN status ENUM('pending','assigned','picking','delivered','cancelled')
      NOT NULL DEFAULT 'pending'
  `);

  // delivery_proofs
  await db.run(`
    CREATE TABLE IF NOT EXISTS delivery_proofs (
      id INT NOT NULL AUTO_INCREMENT,
      delivery_id INT NOT NULL,
      images JSON NULL,
      note TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX(delivery_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  /* ====================== SETTINGS / ANNOUNCEMENTS / PAYMENTS ====================== */

  // site_settings: key-value
  await db.run(`
    CREATE TABLE IF NOT EXISTS site_settings (
      \`key\` VARCHAR(100) PRIMARY KEY,
      \`value\` TEXT NULL,
      updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // announcements
  await db.run(`
    CREATE TABLE IF NOT EXISTS announcements (
      id INT NOT NULL AUTO_INCREMENT,
      title VARCHAR(255) NOT NULL,
      body TEXT NULL,
      status ENUM('draft','published','archived') NOT NULL DEFAULT 'draft',
      published_at DATETIME NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX(status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // payments (dùng cho VietQR/MoMo)
  await db.run(`
    CREATE TABLE IF NOT EXISTS payments (
      id INT NOT NULL AUTO_INCREMENT,
      ref VARCHAR(100) NULL,            -- mã tham chiếu ngoài (txn_id, order_id,…)
      provider VARCHAR(30) NULL,        -- "vietqr", "momo",...
      currency VARCHAR(10) NOT NULL DEFAULT 'VND',
      amount INT NOT NULL DEFAULT 0,
      status ENUM('pending','paid','failed','refunded') NOT NULL DEFAULT 'pending',
      meta JSON NULL,                   -- dữ liệu raw từ provider
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX(provider),
      INDEX(status),
      INDEX(ref)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await safeRun(`SET sql_notes = 1`);
}
