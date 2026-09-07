-- ─────────────────────────────────────────────────────────────────────────────
-- DeenLink — pass 41 migration (2026-09-02)
-- Generated after reading `deenlink_db (9).sql` (the full dump, 66 tables).
--
-- What pass 41 added to the app and what the DB needs for it:
--   1. Scholar signup step 3 lets the applicant choose ONE verification method
--      (documents / letter / links) and agree to Terms + Privacy  → 2 columns.
--   2. Gmail sign-up path (account created via Google, no password set by the
--      user) → 1 column so the backend knows the signup origin.
--   3. Comment @mentions (picker shows DeenLink AI first, then friends; AI
--      mentions trigger in-thread AI replies) → 1 new table for notifications.
--
-- Everything else pass 41 collects already exists:
--   users: username, email, full_name, gender (enum 'male'/'female' — the app
--          sends lowercase), country, phone, aqeedah (varchar 80, fits the
--          ≤10-char "Other" text), tribe (Hausa/Igbo/Yoruba/General), user_type
--          ('user'|'scholar').
--   scholars: display_name, phone, fields_of_knowledge (JSON array),
--          other_field, madhhab, aqeedah, institute, years_of_study (int),
--          teachers, certificate_path, recommendation_path, verification_links,
--          approval_status ('pending' on submit).
--   scholar_documents: per-file rows (certificate / recommendation / other).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1a. Which ONE verification method the scholar applicant picked
ALTER TABLE `scholars`
  ADD COLUMN `verification_method` ENUM('documents','letter','links') NOT NULL DEFAULT 'documents'
  AFTER `verification_links`;

-- 1b. Terms + Privacy agreement timestamp (step 3 checkbox)
ALTER TABLE `scholars`
  ADD COLUMN `terms_agreed_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN `terms_version` VARCHAR(20) DEFAULT 'v1'
  AFTER `verification_method`;

-- 2. Signup origin (password form vs Gmail "complete your info")
ALTER TABLE `users`
  ADD COLUMN `signup_provider` ENUM('password','google') NOT NULL DEFAULT 'password'
  AFTER `two_factor_secret`;

-- 3. Comment @mentions — one row per mention (notifications + AI triggers).
--    `is_ai` marks the built-in @DeenLink AI mention (no user_id to resolve).
CREATE TABLE IF NOT EXISTS `comment_mentions` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `comment_id` BIGINT(20) UNSIGNED DEFAULT NULL,      -- post_comments.id
  `reply_id` BIGINT(20) UNSIGNED DEFAULT NULL,        -- comment_replies.id
  `mentioning_user_id` INT(11) NOT NULL,              -- who typed the @
  `mentioned_user_id` INT(11) DEFAULT NULL,           -- who was @'d (NULL if AI)
  `is_ai` TINYINT(1) NOT NULL DEFAULT 0,              -- 1 = @DeenLink AI
  `handle` VARCHAR(50) NOT NULL,                      -- the raw @handle text
  `notified_at` DATETIME DEFAULT NULL,                -- when pushed to their inbox
  `read_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_cm_comment` (`comment_id`),
  KEY `idx_cm_reply` (`reply_id`),
  KEY `idx_cm_mentioned_user` (`mentioned_user_id`),
  KEY `idx_cm_mentioning_user` (`mentioning_user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Optional but recommended: link scholar_documents to the chosen method's files
-- (no structural change needed — document_type already distinguishes them).
