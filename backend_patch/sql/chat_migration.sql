-- DeenLink — chat presence / last-seen / read receipts (pass 53)
-- Run this once on deenlink_db
-- It creates the missing chat tables that client.ts already expects at /api/chat/*

-- Presence — one row per user, updated by /api/chat/presence.php every 60s
CREATE TABLE IF NOT EXISTS `user_presence` (
  `user_id` INT(11) NOT NULL,
  `last_seen_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`),
  KEY `idx_up_last_seen` (`last_seen_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Conversations — dm or group
CREATE TABLE IF NOT EXISTS `chat_conversations` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `type` ENUM('dm','group') NOT NULL DEFAULT 'dm',
  `title` VARCHAR(191) DEFAULT NULL,
  `created_by` INT(11) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_cc_created_by` (`created_by`),
  KEY `idx_cc_updated` (`updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Participants — who is in which conversation + read cursor
CREATE TABLE IF NOT EXISTS `chat_participants` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `conversation_id` INT(11) NOT NULL,
  `user_id` INT(11) NOT NULL,
  `is_admin` TINYINT(1) NOT NULL DEFAULT 0,
  `joined_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `last_read_at` DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_conv_user` (`conversation_id`,`user_id`),
  KEY `idx_cp_user` (`user_id`),
  KEY `idx_cp_conv` (`conversation_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Messages
CREATE TABLE IF NOT EXISTS `chat_messages` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `conversation_id` INT(11) NOT NULL,
  `sender_id` INT(11) NOT NULL,
  `body` TEXT NOT NULL,
  `media_url` VARCHAR(500) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `read_at` DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_cm_conv_created` (`conversation_id`,`created_at`),
  KEY `idx_cm_sender` (`sender_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Add last_seen column to users if not exists (some builds use it)
-- ALTER TABLE `users` ADD COLUMN `last_seen_at` DATETIME DEFAULT NULL AFTER `last_login`;
