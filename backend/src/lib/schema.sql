﻿-- Kích hoạt kiểm tra khóa ngoại
SET FOREIGN_KEY_CHECKS = 1;

-- =========================
-- 1) Bảng người dùng và vai trò
-- ========================

-- Xóa bảng cũ nếu có (để tránh trùng lỗi khi khởi tạo lại DB)
DROP TABLE IF EXISTS users;

CREATE TABLE IF NOT EXISTS users (
  id            CHAR(36) PRIMARY KEY,                  
  email         VARCHAR(255) NOT NULL UNIQUE,          
  password_hash TEXT NOT NULL,                         
  name          VARCHAR(255) DEFAULT '',               
  avatar_url    TEXT,                                  
  phone         VARCHAR(20),                           
  role          ENUM('user', 'donor', 'receiver', 'shipper', 'admin') NOT NULL DEFAULT 'user',
  status        ENUM('active', 'banned', 'deleted') NOT NULL DEFAULT 'active',
  address       TEXT,                                  
  lat           DECIMAL(10,8),                         
  lng           DECIMAL(11,8),                         
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,   
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP 
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_email ON users(email);

-- Bảng này lưu trữ các vai trò bổ sung nếu cần (một người dùng có thể có nhiều vai trò)
CREATE TABLE IF NOT EXISTS user_roles (
  user_id  CHAR(36) NOT NULL,
  role     VARCHAR(50) NOT NULL,                      -- Vai trò bổ sung
  PRIMARY KEY (user_id, role),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================
-- 2) Tags / Nhãn chế độ ăn
-- =========================
CREATE TABLE IF NOT EXISTS tags (
  id   INT AUTO_INCREMENT PRIMARY KEY,                -- ID tự tăng
  slug VARCHAR(100) NOT NULL UNIQUE,                  -- Slug cho tag (vd: "chay", "khong-lactose")
  name VARCHAR(255) NOT NULL                          -- Tên hiển thị của tag
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Bảng lưu trữ tùy chọn của người dùng
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id      CHAR(36) PRIMARY KEY,                  -- Khóa ngoại đến users
  diet_tags    TEXT DEFAULT '[]',                     -- Mảng JSON các tag chế độ ăn
  radius_km    FLOAT DEFAULT 10,                      -- Bán kính đề xuất (km)
  notif_email  TINYINT DEFAULT 1,                     -- Nhận thông báo email
  notif_push   TINYINT DEFAULT 1,                     -- Nhận thông báo push
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================
-- 3) Điểm nhận đồ ăn
-- =========================
CREATE TABLE IF NOT EXISTS pickup_points (
  id      CHAR(36) PRIMARY KEY,                       -- UUID cho điểm nhận
  name    VARCHAR(255) NOT NULL,                      -- Tên điểm nhận
  address TEXT,                                       -- Địa chỉ đầy đủ
  lat     DECIMAL(10, 8),                             -- Vĩ độ
  lng     DECIMAL(11, 8),                             -- Kinh độ
  opening TEXT,                                       -- Giờ mở cửa (JSON)
  status  ENUM('active', 'inactive') DEFAULT 'active' -- Trạng thái
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================
-- 4) Món ăn và gói đồ ăn
-- =========================
CREATE TABLE IF NOT EXISTS food_items (
  id            CHAR(36) PRIMARY KEY,                 -- UUID cho món ăn
  owner_id      CHAR(36) NOT NULL,                    -- Người tạo (người quyên góp)
  title         VARCHAR(255) NOT NULL,                -- Tiêu đề món ăn
  description   TEXT,                                 -- Mô tả chi tiết
  qty           INT NOT NULL DEFAULT 1,               -- Số suất
  unit          VARCHAR(50) DEFAULT 'suat',           -- Đơn vị tính
  expire_at     DATETIME,                             -- Hạn sử dụng
  location_addr TEXT,                                 -- Địa chỉ lấy đồ
  lat           DECIMAL(10, 8),                       -- Vĩ độ
  lng           DECIMAL(11, 8),                       -- Kinh độ
  tags          TEXT DEFAULT '[]',                    -- Mảng JSON các tag
  images        TEXT DEFAULT '[]',                    -- Mảng JSON URLs hình ảnh
  status        ENUM('available', 'reserved', 'given', 'expired', 'hidden') NOT NULL DEFAULT 'available', -- Trạng thái
  visibility    ENUM('public', 'private') NOT NULL DEFAULT 'public', -- Hiển thị
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,  -- Thời gian tạo
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, -- Thời gian cập nhật
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_food_status ON food_items(status);
CREATE INDEX idx_food_owner ON food_items(owner_id);
CREATE INDEX idx_food_geo ON food_items(lat, lng);

-- Bảng gói đồ ăn (gộp nhiều món)
CREATE TABLE IF NOT EXISTS bundles (
  id          CHAR(36) PRIMARY KEY,                   -- UUID cho gói
  owner_id    CHAR(36) NOT NULL,                      -- Người tạo gói
  title       VARCHAR(255) NOT NULL,                  -- Tiêu đề gói
  description TEXT,                                   -- Mô tả
  cover       TEXT,                                   -- URL ảnh cover
  tags        TEXT DEFAULT '[]',                      -- Mảng JSON các tag
  status      ENUM('active', 'closed') DEFAULT 'active', -- Trạng thái
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,    -- Thời gian tạo
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Bảng liên kết gói và món ăn
CREATE TABLE IF NOT EXISTS bundle_items (
  bundle_id CHAR(36) NOT NULL,
  item_id   CHAR(36) NOT NULL,
  PRIMARY KEY (bundle_id, item_id),
  FOREIGN KEY (bundle_id) REFERENCES bundles(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES food_items(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================
-- 5) Đặt đồ ăn
-- =========================
CREATE TABLE IF NOT EXISTS bookings (
  id           CHAR(36) PRIMARY KEY,                  -- UUID cho booking
  item_id      CHAR(36),                              -- ID món ăn (nếu đặt món riêng)
  bundle_id    CHAR(36),                              -- ID gói (nếu đặt cả gói)
  receiver_id  CHAR(36) NOT NULL,                     -- Người nhận
  qty          INT NOT NULL DEFAULT 1,                -- Số lượng
  note         TEXT,                                  -- Ghi chú
  method       ENUM('pickup', 'meet', 'delivery') DEFAULT 'pickup', -- Phương thức nhận
  pickup_point CHAR(36),                              -- Điểm nhận (nếu có)
  status       ENUM('pending', 'accepted', 'rejected', 'cancelled', 'completed', 'expired') NOT NULL DEFAULT 'pending', -- Trạng thái
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,   -- Thời gian tạo
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, -- Thời gian cập nhật
  UNIQUE KEY unique_booking (item_id, receiver_id),   -- Mỗi người chỉ đặt 1 món 1 lần
  FOREIGN KEY (item_id) REFERENCES food_items(id) ON DELETE SET NULL,
  FOREIGN KEY (bundle_id) REFERENCES bundles(id) ON DELETE SET NULL,
  FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (pickup_point) REFERENCES pickup_points(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_booking_status ON bookings(status);
CREATE INDEX idx_booking_receiver ON bookings(receiver_id);

-- =========================
-- 6) Thanh toán (phí 2k/bữa)
-- =========================
CREATE TABLE IF NOT EXISTS payments (
  id          CHAR(36) PRIMARY KEY,                   -- UUID cho payment
  booking_id  CHAR(36) NOT NULL,                      -- Booking liên quan
  payer_id    CHAR(36) NOT NULL,                      -- Người thanh toán
  amount      INT NOT NULL,                           -- Số tiền (VND)
  provider    ENUM('momo', 'vnpay', 'zalopay'),       -- Cổng thanh toán
  provider_txn VARCHAR(255),                          -- Mã giao dịch từ cổng
  status      ENUM('pending', 'paid', 'failed', 'refunded') NOT NULL DEFAULT 'pending', -- Trạng thái
  meta        TEXT DEFAULT '{}',                      -- Dữ liệu bổ sung (JSON)
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,    -- Thời gian tạo
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  FOREIGN KEY (payer_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_pay_status ON payments(status);

-- =========================
-- 7) Giao hàng / Tình nguyện viên
-- =========================
CREATE TABLE IF NOT EXISTS deliveries (
  id            CHAR(36) PRIMARY KEY,                 -- UUID cho delivery
  booking_id    CHAR(36) NOT NULL,                    -- Booking liên quan
  shipper_id    CHAR(36) NOT NULL,                    -- Người giao hàng
  status        ENUM('assigned', 'picking', 'delivering', 'delivered', 'failed', 'cancelled') NOT NULL DEFAULT 'assigned', -- Trạng thái
  otp_code      VARCHAR(10),                          -- Mã OTP xác nhận
  proof_images  TEXT DEFAULT '[]',                    -- Mảng JSON URLs hình ảnh làm bằng chứng
  route_geojson TEXT,                                 -- Dữ liệu lộ trình (GeoJSON)
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,  -- Thời gian tạo
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, -- Thời gian cập nhật
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  FOREIGN KEY (shipper_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_delivery_status ON deliveries(status);
CREATE INDEX idx_delivery_shipper ON deliveries(shipper_id);

-- =========================
-- 8) Báo cáo / Khiếu nại
-- =========================
CREATE TABLE IF NOT EXISTS reports (
  id          CHAR(36) PRIMARY KEY,                   -- UUID cho report
  reporter_id CHAR(36) NOT NULL,                      -- Người báo cáo
  target_type ENUM('item', 'user', 'booking', 'bundle') NOT NULL, -- Loại đối tượng
  target_id   CHAR(36) NOT NULL,                      -- ID đối tượng
  reason      TEXT NOT NULL,                          -- Lý do báo cáo
  status      ENUM('open', 'reviewing', 'resolved', 'rejected') DEFAULT 'open', -- Trạng thái
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,    -- Thời gian tạo
  FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================
-- 9) Thông báo
-- =========================
CREATE TABLE IF NOT EXISTS notifications (
  id         CHAR(36) PRIMARY KEY,                    -- UUID cho notification
  user_id    CHAR(36) NOT NULL,                       -- Người nhận
  type       ENUM('booking_update', 'delivery_update', 'system', 'payment_update') NOT NULL, -- Loại thông báo
  title      VARCHAR(255) NOT NULL,                   -- Tiêu đề
  body       TEXT,                                    -- Nội dung
  seen       TINYINT DEFAULT 0,                       -- Đã xem hay chưa
  data       TEXT DEFAULT '{}',                       -- Dữ liệu bổ sung (JSON)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,     -- Thời gian tạo
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_notif_user ON notifications(user_id);

-- =========================
-- 10) Cài đặt ứng dụng / Nhật ký
-- =========================
CREATE TABLE IF NOT EXISTS app_settings (
  key   VARCHAR(100) PRIMARY KEY,                     -- Khóa cài đặt
  value TEXT NOT NULL                                 -- Giá trị (JSON)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS audit_logs (
  id         CHAR(36) PRIMARY KEY,                    -- UUID cho log
  user_id    CHAR(36),                                -- Người dùng liên quan
  action     VARCHAR(100) NOT NULL,                   -- Hành động (vd: "booking.create")
  entity     VARCHAR(50),                             -- Thực thể (vd: "bookings")
  entity_id  CHAR(36),                                -- ID thực thể
  ip         VARCHAR(45),                             -- Địa chỉ IP
  ua         TEXT,                                    -- User-Agent
  meta       TEXT DEFAULT '{}',                       -- Dữ liệu bổ sung (JSON)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,     -- Thời gian tạo
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================
-- 11) Phân tích / Thống kê
-- =========================
CREATE TABLE IF NOT EXISTS metrics_daily (
  day           DATE PRIMARY KEY,                     -- Ngày (YYYY-MM-DD)
  items         INT DEFAULT 0,                        -- Số món ăn
  bookings      INT DEFAULT 0,                        -- Số booking
  deliveries    INT DEFAULT 0,                        -- Số giao hàng
  rescued_meals INT DEFAULT 0,                        -- Tổng số bữa cứu được
  fee_revenue   INT DEFAULT 0                         -- Tổng phí thu được
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================
-- 12) Chiến dịch
-- =========================
CREATE TABLE IF NOT EXISTS campaigns (
  id          CHAR(36) PRIMARY KEY,                   -- UUID cho campaign
  title       VARCHAR(255) NOT NULL,                  -- Tiêu đề chiến dịch
  location    VARCHAR(255) DEFAULT "",                -- Địa điểm
  goal        INT NOT NULL DEFAULT 0,                 -- Mục tiêu
  raised      INT NOT NULL DEFAULT 0,                 -- Số tiền đã quyên góp
  supporters  INT NOT NULL DEFAULT 0,                 -- Số người ủng hộ
  tags        TEXT DEFAULT "[]",                      -- Mảng JSON các tag
  cover       VARCHAR(500) DEFAULT "",                -- URL ảnh cover
  status      ENUM('active', 'closed') DEFAULT 'active', -- Trạng thái
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP     -- Thời gian tạo
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;