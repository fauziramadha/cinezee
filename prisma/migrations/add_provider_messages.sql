-- ============================================================
-- Migration: Provider Management & Admin Messaging
-- Run this SQL in Cloudflare D1 Console (one statement at a time)
-- ============================================================

-- ============================================================
-- TABLE 1: provider_config
-- Dynamic streaming providers managed by admin
-- Replaces hardcoded providers in src/lib/providers.ts
-- ============================================================
CREATE TABLE IF NOT EXISTS provider_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  server_label TEXT NOT NULL,
  embed_base TEXT NOT NULL,
  movie_path TEXT NOT NULL,
  tv_path TEXT NOT NULL,
  brutality INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  api_key TEXT,
  api_key_param TEXT,
  debug_param TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ============================================================
-- TABLE 2: admin_message
-- Messages sent by admin to user(s)
-- recipient_id = NULL means BROADCAST to all users
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_message (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_id TEXT NOT NULL,
  sender_name TEXT,
  recipient_id TEXT,
  recipient_name TEXT,
  subject TEXT,
  body TEXT NOT NULL,
  type TEXT DEFAULT 'info',
  is_pinned INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_admin_message_recipient ON admin_message(recipient_id);
CREATE INDEX IF NOT EXISTS idx_admin_message_created ON admin_message(created_at DESC);

-- ============================================================
-- TABLE 3: admin_message_read
-- Tracks which users have read which messages
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_message_read (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  read_at TEXT DEFAULT (datetime('now')),
  UNIQUE(message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_message_read_user ON admin_message_read(user_id);

-- ============================================================
-- SEED: Default providers
-- ============================================================
INSERT INTO provider_config (name, server_label, embed_base, movie_path, tv_path, brutality, is_active, sort_order, api_key, debug_param) VALUES
  ('Server 1', 'FilmU Premium', 'https://embed.filmu.in', 'embed/movie', 'embed/tv', 0, 1, 1, 'zyflix_premium_9x8c7v6b5n', NULL),
  ('Server 2', 'FilmU Debug', 'https://embed.filmu.in', 'embed/movie', 'embed/tv', 0, 1, 2, NULL, 'debug=savu'),
  ('Server 3', 'VidLink', 'https://vidlink.pro', 'movie', 'tv', 1, 1, 3, NULL, NULL),
  ('Server 4', 'VidEasy', 'https://videasy.to', 'player', 'player', 2, 1, 4, NULL, NULL),
  ('Server 5', 'VidFast', 'https://vidfast.pro', 'movie', 'tv', 3, 1, 5, NULL, NULL),
  ('Server 6', 'VidSrc', 'https://vidsrc-embed.ru', 'embed/movie', 'embed/tv', 3, 1, 6, NULL, NULL),
  ('Server 7', 'VidRock', 'https://vidrock.ru', 'embed/movie', 'embed/tv', 4, 1, 7, NULL, NULL),
  ('Server 8', 'SuperEmbed', 'https://multiembed.mov', 'directstream/movie', 'directstream/tv', 5, 1, 8, NULL, NULL);
