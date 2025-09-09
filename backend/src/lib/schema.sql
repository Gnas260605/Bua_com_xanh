-- =========================
-- Schema cho database bua_com_xanh (FULL, khớp backend)
-- =========================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1) announcements
DROP TABLE IF EXISTS `announcements`;
CREATE TABLE `announcements` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `content` text NOT NULL,
  `level` varchar(50) NOT NULL DEFAULT 'info',
  `active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2) app_settings
DROP TABLE IF EXISTS `app_settings`;
CREATE TABLE `app_settings` (
  `key` varchar(100) NOT NULL,
  `value` longtext NOT NULL,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3) audit_logs (giữ UUID + bổ sung cột mà API dùng)
DROP TABLE IF EXISTS `audit_logs`;
CREATE TABLE `audit_logs` (
  `id` char(36) NOT NULL,
  `user_id` char(36) DEFAULT NULL,
  `action` varchar(100) NOT NULL,
  `entity` varchar(50) DEFAULT NULL,
  `entity_id` char(36) DEFAULT NULL,
  `ip` varchar(45) DEFAULT NULL,
  `ua` varchar(255) DEFAULT NULL,
  `meta` longtext NOT NULL DEFAULT (json_object()),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `actor_id` varchar(255) DEFAULT NULL,
  `target_id` varchar(255) DEFAULT NULL,
  `detail` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_audit_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4) users (thêm address; mở rộng status để có 'locked')
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` char(36) NOT NULL,
  `email` varchar(255) NOT NULL UNIQUE,
  `password_hash` text NOT NULL,
  `name` varchar(255) DEFAULT '',
  `phone` varchar(20) DEFAULT NULL,
  `address` varchar(255) DEFAULT NULL,
  `avatar_url` text DEFAULT NULL,
  `role` enum('user','donor','receiver','shipper','admin') NOT NULL DEFAULT 'user',
  `status` enum('active','locked','deleted','banned') NOT NULL DEFAULT 'active',
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_users_role` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5) user_roles
DROP TABLE IF EXISTS `user_roles`;
CREATE TABLE `user_roles` (
  `user_id` char(36) NOT NULL,
  `role` varchar(50) NOT NULL,
  PRIMARY KEY (`user_id`,`role`),
  CONSTRAINT `fk_roles_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6) tags
DROP TABLE IF EXISTS `tags`;
CREATE TABLE `tags` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `slug` varchar(100) NOT NULL UNIQUE,
  `name` varchar(255) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7) user_preferences
DROP TABLE IF EXISTS `user_preferences`;
CREATE TABLE `user_preferences` (
  `user_id` char(36) NOT NULL,
  `diet_tags` text DEFAULT '[]',
  `radius_km` float DEFAULT 10,
  `notif_email` tinyint(1) DEFAULT 1,
  `notif_push` tinyint(1) DEFAULT 1,
  PRIMARY KEY (`user_id`),
  CONSTRAINT `fk_pref_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 8) pickup_points (thêm active + updated_at, giữ status cũ)
DROP TABLE IF EXISTS `pickup_points`;
CREATE TABLE `pickup_points` (
  `id` char(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `address` text DEFAULT NULL,
  `lat` decimal(10,8) DEFAULT NULL,
  `lng` decimal(11,8) DEFAULT NULL,
  `opening` text DEFAULT NULL,
  `status` enum('active','inactive') DEFAULT 'active',
  `active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 9) food_items (bổ sung quantity, expires_at để khớp API; vẫn giữ qty, expire_at)
DROP TABLE IF EXISTS `food_items`;
CREATE TABLE `food_items` (
  `id` char(36) NOT NULL,
  `owner_id` char(36) NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text,
  `qty` int NOT NULL DEFAULT 1,
  `quantity` int NOT NULL DEFAULT 1,          -- dùng bởi /admin/foods
  `unit` varchar(50) DEFAULT 'suat',
  `expire_at` datetime DEFAULT NULL,
  `expires_at` datetime DEFAULT NULL,         -- dùng bởi /admin/foods + expire-now
  `location_addr` text DEFAULT NULL,
  `lat` decimal(10,8) DEFAULT NULL,
  `lng` decimal(11,8) DEFAULT NULL,
  `tags` text DEFAULT '[]',
  `images` text DEFAULT '[]',
  `status` enum('available','reserved','given','expired','hidden') NOT NULL DEFAULT 'available',
  `visibility` enum('public','private') NOT NULL DEFAULT 'public',
  `created_at` timestamp DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_food_owner` (`owner_id`),
  CONSTRAINT `fk_food_owner` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 10) bundles
DROP TABLE IF EXISTS `bundles`;
CREATE TABLE `bundles` (
  `id` char(36) NOT NULL,
  `owner_id` char(36) NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text,
  `cover` text,
  `tags` text DEFAULT '[]',
  `status` enum('active','closed') DEFAULT 'active',
  `created_at` timestamp DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_bundle_owner` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 11) bundle_items
DROP TABLE IF EXISTS `bundle_items`;
CREATE TABLE `bundle_items` (
  `bundle_id` char(36) NOT NULL,
  `item_id` char(36) NOT NULL,
  PRIMARY KEY (`bundle_id`,`item_id`),
  CONSTRAINT `fk_bundleitem_bundle` FOREIGN KEY (`bundle_id`) REFERENCES `bundles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_bundleitem_item` FOREIGN KEY (`item_id`) REFERENCES `food_items` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 12) bookings
DROP TABLE IF EXISTS `bookings`;
CREATE TABLE `bookings` (
  `id` char(36) NOT NULL,
  `item_id` char(36) DEFAULT NULL,
  `bundle_id` char(36) DEFAULT NULL,
  `receiver_id` char(36) NOT NULL,
  `qty` int NOT NULL DEFAULT 1,
  `note` text,
  `method` enum('pickup','meet','delivery') DEFAULT 'pickup',
  `pickup_point` char(36) DEFAULT NULL,
  `status` enum('pending','accepted','rejected','cancelled','completed','expired','requested','new') NOT NULL DEFAULT 'pending',
  `created_at` timestamp DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT NULL,
  `expires_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_booking_receiver` (`receiver_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 13) payments (thêm updated_at)
DROP TABLE IF EXISTS `payments`;
CREATE TABLE `payments` (
  `id` char(36) NOT NULL,
  `booking_id` char(36) NOT NULL,
  `payer_id` char(36) NOT NULL,
  `amount` int NOT NULL,
  `provider` enum('momo','vnpay','zalopay'),
  `provider_txn` varchar(255) DEFAULT NULL,
  `status` enum('pending','paid','failed','refunded') DEFAULT 'pending',
  `meta` text DEFAULT '{}',
  `created_at` timestamp DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 14) deliveries (bổ sung qty)
DROP TABLE IF EXISTS `deliveries`;
CREATE TABLE `deliveries` (
  `id` char(36) NOT NULL,
  `booking_id` char(36) NOT NULL,
  `shipper_id` char(36) NOT NULL,
  `status` enum('assigned','picking','delivering','delivered','failed','cancelled','done','completed') DEFAULT 'assigned',
  `qty` int NOT NULL DEFAULT 0,
  `otp_code` varchar(10) DEFAULT NULL,
  `proof_images` text DEFAULT '[]',
  `route_geojson` text DEFAULT NULL,
  `created_at` timestamp DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 15) reports (thêm target_user_id, target_item_id, notes, resolved_at)
DROP TABLE IF EXISTS `reports`;
CREATE TABLE `reports` (
  `id` char(36) NOT NULL,
  `reporter_id` char(36) NOT NULL,
  `target_type` enum('item','user','booking','bundle') NOT NULL,
  `target_id` char(36) NOT NULL,
  `target_user_id` char(36) DEFAULT NULL,
  `target_item_id` char(36) DEFAULT NULL,
  `reason` text NOT NULL,
  `notes` text DEFAULT NULL,
  `status` enum('open','reviewing','resolved','rejected','closed','dismissed') DEFAULT 'open',
  `created_at` timestamp DEFAULT current_timestamp(),
  `resolved_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_reporter` (`reporter_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 16) notifications
DROP TABLE IF EXISTS `notifications`;
CREATE TABLE `notifications` (
  `id` char(36) NOT NULL,
  `user_id` char(36) NOT NULL,
  `type` enum('booking_update','delivery_update','system','payment_update') NOT NULL,
  `title` varchar(255) NOT NULL,
  `body` text DEFAULT NULL,
  `seen` tinyint(1) DEFAULT 0,
  `data` text DEFAULT '{}',
  `created_at` timestamp DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_notif_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 17) metrics_daily
DROP TABLE IF EXISTS `metrics_daily`;
CREATE TABLE `metrics_daily` (
  `day` date NOT NULL,
  `items` int DEFAULT 0,
  `bookings` int DEFAULT 0,
  `deliveries` int DEFAULT 0,
  `rescued_meals` int DEFAULT 0,
  `fee_revenue` int DEFAULT 0,
  PRIMARY KEY (`day`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 18) campaigns (đã mở rộng để khớp API AdminCampaigns + deadline)
DROP TABLE IF EXISTS `campaigns`;
CREATE TABLE `campaigns` (
  `id` char(36) NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `cover_url` varchar(512) DEFAULT NULL,
  `status` enum('draft','active','archived') NOT NULL DEFAULT 'draft',
  `target_amount` bigint NOT NULL DEFAULT 0,
  `raised_amount` bigint NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT NULL,
  `deadline` datetime DEFAULT NULL,   
  `location` varchar(255) DEFAULT '',
  `goal` int DEFAULT 0,
  `raised` int DEFAULT 0,
  `supporters` int DEFAULT 0,
  `tags` text DEFAULT '[]',
  `cover` varchar(500) DEFAULT '',
  PRIMARY KEY (`id`),
  KEY `idx_campaigns_status` (`status`),
  KEY `idx_campaigns_deadline` (`deadline`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- 19) migrations
DROP TABLE IF EXISTS `migrations`;
CREATE TABLE `migrations` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `migration` varchar(255) NOT NULL,
  `batch` int NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 20) otp_codes
DROP TABLE IF EXISTS `otp_codes`;
CREATE TABLE `otp_codes` (
  `id` char(36) NOT NULL,
  `user_id` char(36) NOT NULL,
  `code` varchar(10) NOT NULL,
  `expire_at` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 21) password_resets
DROP TABLE IF EXISTS `password_resets`;
CREATE TABLE `password_resets` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `email` varchar(255) NOT NULL,
  `token` varchar(255) NOT NULL,
  `created_at` timestamp DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 22) site_settings
DROP TABLE IF EXISTS `site_settings`;
CREATE TABLE `site_settings` (
  `k` varchar(128) NOT NULL,
  `v` text NOT NULL,
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`k`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 23) cms_pages (mới, dùng bởi /api/admin/pages)
DROP TABLE IF EXISTS `cms_pages`;
CREATE TABLE `cms_pages` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `slug` varchar(128) NOT NULL UNIQUE,
  `title` varchar(255) NOT NULL,
  `content` mediumtext NOT NULL,
  `status` varchar(16) NOT NULL DEFAULT 'draft',
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 24) tasks (mới, dùng bởi /api/admin/tasks)
DROP TABLE IF EXISTS `tasks`;
CREATE TABLE `tasks` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `parent_id` int(11) DEFAULT NULL,
  `title` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `type` varchar(24) NOT NULL DEFAULT 'TASK',
  `status` varchar(24) NOT NULL DEFAULT 'New',
  `priority` varchar(16) NOT NULL DEFAULT 'Normal',
  `assignee_id` char(36) DEFAULT NULL,
  `sort_order` int NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_task_parent` (`parent_id`),
  KEY `idx_task_status` (`status`),
  KEY `idx_task_type` (`type`),
  KEY `idx_task_assignee` (`assignee_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 25) task_comments (mới, dùng bởi /api/admin/tasks/:id/comments)
DROP TABLE IF EXISTS `task_comments`;
CREATE TABLE `task_comments` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `task_id` int(11) NOT NULL,
  `author_id` char(36) DEFAULT NULL,
  `content` text NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_task_comments_task` (`task_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;
