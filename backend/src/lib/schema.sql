PRAGMA foreign_keys = ON;

-- =========================
-- 1) Users & Roles
-- =========================
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT DEFAULT '',
  phone         TEXT,
  avatar_url    TEXT,
  role          TEXT NOT NULL DEFAULT 'user',           -- user | donor | receiver | shipper | admin
  status        TEXT NOT NULL DEFAULT 'active',         -- active | banned | deleted
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Optional: phân quyền chi tiết cho tương lai
CREATE TABLE IF NOT EXISTS user_roles (
  user_id  TEXT NOT NULL,
  role     TEXT NOT NULL,                               -- extra roles: donor/receiver/shipper
  PRIMARY KEY (user_id, role),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- =========================
-- 2) Tags / Dietary labels
-- =========================
CREATE TABLE IF NOT EXISTS tags (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,                            -- vd: "chay", "khong-lactose"
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id     TEXT NOT NULL PRIMARY KEY,
  diet_tags   TEXT DEFAULT '[]',                        -- JSON array string of tag slugs
  radius_km   REAL DEFAULT 10,                          -- bán kính đề xuất
  notif_email INTEGER DEFAULT 1,
  notif_push  INTEGER DEFAULT 1,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- =========================
-- 3) Pickup points (điểm nhận)
-- =========================
CREATE TABLE IF NOT EXISTS pickup_points (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  address     TEXT,
  lat         REAL,    -- WGS84
  lng         REAL,
  opening     TEXT,    -- JSON giờ mở cửa
  status      TEXT DEFAULT 'active'   -- active | inactive
);

-- =========================
-- 4) Food items & bundles
-- =========================
CREATE TABLE IF NOT EXISTS food_items (
  id            TEXT PRIMARY KEY,
  owner_id      TEXT NOT NULL,                          -- users.id (donor)
  title         TEXT NOT NULL,
  description   TEXT,
  qty           INTEGER NOT NULL DEFAULT 1,             -- số suất
  unit          TEXT DEFAULT 'suat',
  expire_at     DATETIME,                               -- hạn dùng
  location_addr TEXT,
  lat           REAL,
  lng           REAL,
  tags          TEXT DEFAULT '[]',                      -- JSON tag slugs (chay, ko-gluten...)
  images        TEXT DEFAULT '[]',                      -- JSON URLs
  status        TEXT NOT NULL DEFAULT 'available',      -- available | reserved | given | expired | hidden
  visibility    TEXT NOT NULL DEFAULT 'public',         -- public | private
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_food_status ON food_items(status);
CREATE INDEX IF NOT EXISTS idx_food_owner  ON food_items(owner_id);
CREATE INDEX IF NOT EXISTS idx_food_geo    ON food_items(lat, lng);

-- Bundle (gộp nhiều món thành bữa)
CREATE TABLE IF NOT EXISTS bundles (
  id          TEXT PRIMARY KEY,
  owner_id    TEXT NOT NULL,
  title       TEXT NOT NULL,
  description TEXT,
  cover       TEXT,
  tags        TEXT DEFAULT '[]',
  status      TEXT DEFAULT 'active',                    -- active | closed
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bundle_items (
  bundle_id TEXT NOT NULL,
  item_id   TEXT NOT NULL,
  PRIMARY KEY (bundle_id, item_id),
  FOREIGN KEY (bundle_id) REFERENCES bundles(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id)   REFERENCES food_items(id) ON DELETE CASCADE
);

-- =========================
-- 5) Booking (đặt nhận)
-- =========================
CREATE TABLE IF NOT EXISTS bookings (
  id            TEXT PRIMARY KEY,
  item_id       TEXT,                                   -- đặt đơn món
  bundle_id     TEXT,                                   -- hoặc đặt bundle
  receiver_id   TEXT NOT NULL,                          -- users.id
  qty           INTEGER NOT NULL DEFAULT 1,
  note          TEXT,
  method        TEXT DEFAULT 'pickup',                  -- pickup | meet | delivery
  pickup_point  TEXT,                                   -- pickup_points.id (nullable)
  status        TEXT NOT NULL DEFAULT 'pending',        -- pending | accepted | rejected | cancelled | completed | expired
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME,
  UNIQUE(item_id, receiver_id) ON CONFLICT IGNORE,
  FOREIGN KEY (item_id)     REFERENCES food_items(id) ON DELETE SET NULL,
  FOREIGN KEY (bundle_id)   REFERENCES bundles(id) ON DELETE SET NULL,
  FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (pickup_point) REFERENCES pickup_points(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_booking_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_booking_receiver ON bookings(receiver_id);

-- =========================
-- 6) Payment (phí 2k/bữa)
-- =========================
CREATE TABLE IF NOT EXISTS payments (
  id           TEXT PRIMARY KEY,
  booking_id   TEXT NOT NULL,
  payer_id     TEXT NOT NULL,                           -- users.id (receiver)
  amount       INTEGER NOT NULL,                        -- VND
  provider     TEXT,                                    -- momo | vnpay | zalopay
  provider_txn TEXT,                                    -- mã giao dịch cổng
  status       TEXT NOT NULL DEFAULT 'pending',         -- pending | paid | failed | refunded
  meta         TEXT DEFAULT '{}',                       -- JSON
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  FOREIGN KEY (payer_id)   REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pay_status ON payments(status);

-- =========================
-- 7) Delivery / Shipper (tình nguyện)
-- =========================
CREATE TABLE IF NOT EXISTS deliveries (
  id            TEXT PRIMARY KEY,
  booking_id    TEXT NOT NULL,
  shipper_id    TEXT NOT NULL,                          -- users.id
  status        TEXT NOT NULL DEFAULT 'assigned',       -- assigned | picking | delivering | delivered | failed | cancelled
  otp_code      TEXT,                                   -- xác nhận bàn giao
  proof_images  TEXT DEFAULT '[]',                      -- JSON URLs
  route_geojson TEXT,                                   -- lộ trình (JSON)
  updated_at    DATETIME,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  FOREIGN KEY (shipper_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_delivery_status ON deliveries(status);
CREATE INDEX IF NOT EXISTS idx_delivery_shipper ON deliveries(shipper_id);

-- =========================
-- 8) Reports / Complaints (báo cáo vi phạm, đồ ăn không an toàn)
-- =========================
CREATE TABLE IF NOT EXISTS reports (
  id          TEXT PRIMARY KEY,
  reporter_id TEXT NOT NULL,
  target_type TEXT NOT NULL,                            -- item | user | booking | bundle
  target_id   TEXT NOT NULL,
  reason      TEXT NOT NULL,
  status      TEXT DEFAULT 'open',                      -- open | reviewing | resolved | rejected
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE
);

-- =========================
-- 9) Notifications
-- =========================
CREATE TABLE IF NOT EXISTS notifications (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  type        TEXT NOT NULL,                            -- booking_update | delivery_update | system | payment_update
  title       TEXT NOT NULL,
  body        TEXT,
  seen        INTEGER DEFAULT 0,
  data        TEXT DEFAULT '{}',                        -- JSON payload
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id);

-- =========================
-- 10) App settings / RBAC / Audit
-- =========================
CREATE TABLE IF NOT EXISTS app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL                                  -- JSON string
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id         TEXT PRIMARY KEY,
  user_id    TEXT,
  action     TEXT NOT NULL,                            -- ex: "booking.create"
  entity     TEXT,                                     -- ex: "bookings"
  entity_id  TEXT,
  ip         TEXT,
  ua         TEXT,
  meta       TEXT DEFAULT '{}',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- =========================
-- 11) Analytics (tối giản)
-- =========================
CREATE TABLE IF NOT EXISTS metrics_daily (
  day        TEXT PRIMARY KEY,                         -- YYYY-MM-DD
  items      INTEGER DEFAULT 0,
  bookings   INTEGER DEFAULT 0,
  deliveries INTEGER DEFAULT 0,
  rescued_meals INTEGER DEFAULT 0,                     -- tổng số bữa cứu được
  fee_revenue  INTEGER DEFAULT 0                       -- tổng phí 2k thu được
);
-- campaigns
CREATE TABLE IF NOT EXISTS campaigns(
  id           CHAR(36) PRIMARY KEY,
  title        VARCHAR(255) NOT NULL,
  location     VARCHAR(255) DEFAULT "",
  goal         INTEGER NOT NULL DEFAULT 0,
  raised       INTEGER NOT NULL DEFAULT 0,
  supporters   INTEGER NOT NULL DEFAULT 0,
  tags         TEXT DEFAULT "[]",
  cover        VARCHAR(500) DEFAULT "",
  status       ENUM("active","closed") DEFAULT "active",
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
