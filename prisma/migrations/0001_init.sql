-- =====================================================
-- CineStream Database Schema - Initial Migration
-- Cloudflare D1 (SQLite)
-- =====================================================
-- Run this in: Cloudflare Dashboard → D1 → cinezee-db → Query → paste & Run
-- =====================================================

-- Enable foreign key support (required for SQLite)
PRAGMA foreign_keys = ON;

-- =====================================================
-- NextAuth.js Tables (Required for Authentication)
-- =====================================================

-- Users table
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TEXT,
    "image" TEXT,
    "password" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "language" TEXT NOT NULL DEFAULT 'en',
    "banned" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create unique index on email
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

-- Accounts table (for OAuth providers like Google)
CREATE TABLE IF NOT EXISTS "Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- Create unique index on provider + providerAccountId
CREATE UNIQUE INDEX IF NOT EXISTS "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- Create index on userId for faster queries
CREATE INDEX IF NOT EXISTS "Account_userId_idx" ON "Account"("userId");

-- Sessions table (for database sessions - optional with JWT but good to have)
CREATE TABLE IF NOT EXISTS "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TEXT NOT NULL,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "Session_sessionToken_key" ON "Session"("sessionToken");
CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "Session"("userId");

-- Verification tokens table (for email verification)
CREATE TABLE IF NOT EXISTS "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- =====================================================
-- App Tables
-- =====================================================

-- Watchlist - "Save to Watch Later"
CREATE TABLE IF NOT EXISTS "Watchlist" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "mediaId" INTEGER NOT NULL,
    "mediaType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "posterPath" TEXT,
    "backdropPath" TEXT,
    "addedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "Watchlist_userId_mediaId_mediaType_key" ON "Watchlist"("userId", "mediaId", "mediaType");
CREATE INDEX IF NOT EXISTS "Watchlist_userId_idx" ON "Watchlist"("userId");

-- Watch History - "Continue Watching"
CREATE TABLE IF NOT EXISTS "WatchHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "mediaId" INTEGER NOT NULL,
    "mediaType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "posterPath" TEXT,
    "backdropPath" TEXT,
    "season" INTEGER,
    "episode" INTEGER,
    "progress" REAL NOT NULL DEFAULT 0,
    "watchedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "WatchHistory_userId_mediaId_mediaType_key" ON "WatchHistory"("userId", "mediaId", "mediaType");
CREATE INDEX IF NOT EXISTS "WatchHistory_userId_idx" ON "WatchHistory"("userId");

-- Ratings & Reviews
CREATE TABLE IF NOT EXISTS "Rating" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "mediaId" INTEGER NOT NULL,
    "mediaType" TEXT NOT NULL,
    "rating" REAL NOT NULL,
    "review" TEXT,
    "createdAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "Rating_userId_mediaId_mediaType_key" ON "Rating"("userId", "mediaId", "mediaType");
CREATE INDEX IF NOT EXISTS "Rating_mediaId_mediaType_idx" ON "Rating"("mediaId", "mediaType");
CREATE INDEX IF NOT EXISTS "Rating_userId_idx" ON "Rating"("userId");

-- Comments (with nested replies support)
CREATE TABLE IF NOT EXISTS "Comment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "mediaId" INTEGER NOT NULL,
    "mediaType" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
    FOREIGN KEY ("parentId") REFERENCES "Comment"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "Comment_mediaId_mediaType_idx" ON "Comment"("mediaId", "mediaType");
CREATE INDEX IF NOT EXISTS "Comment_userId_idx" ON "Comment"("userId");
CREATE INDEX IF NOT EXISTS "Comment_parentId_idx" ON "Comment"("parentId");

-- Notifications
CREATE TABLE IF NOT EXISTS "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" TEXT,
    "read" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "Notification_userId_read_idx" ON "Notification"("userId", "read");
CREATE INDEX IF NOT EXISTS "Notification_createdAt_idx" ON "Notification"("createdAt");

-- Analytics Events
CREATE TABLE IF NOT EXISTS "AnalyticsEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "eventType" TEXT NOT NULL,
    "mediaId" INTEGER,
    "mediaType" TEXT,
    "metadata" TEXT,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "createdAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "AnalyticsEvent_eventType_createdAt_idx" ON "AnalyticsEvent"("eventType", "createdAt");
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_userId_idx" ON "AnalyticsEvent"("userId");
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_createdAt_idx" ON "AnalyticsEvent"("createdAt");

-- =====================================================
-- Prisma Migration Tracking Table
-- (Required by Prisma to know which migrations have been applied)
-- =====================================================
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "checksum" TEXT NOT NULL,
    "finished_at" DATETIME,
    "migration_name" TEXT NOT NULL,
    "logs" TEXT,
    "rolled_back_at" DATETIME,
    "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "applied_steps_count" INTEGER NOT NULL DEFAULT 0
);

-- Insert migration record (mark 0001_init as applied)
INSERT INTO "_prisma_migrations" ("id", "checksum", "migration_name", "started_at", "finished_at", "applied_steps_count")
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'cinesstream_init_migration_manual',
    '0001_init',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    1
);

-- =====================================================
-- Done! All tables created successfully.
-- =====================================================
-- Tables created:
--   1. User              - User accounts
--   2. Account           - OAuth provider links (Google)
--   3. Session           - Database sessions
--   4. VerificationToken - Email verification tokens
--   5. Watchlist         - Save to watch later
--   6. WatchHistory      - Continue watching
--   7. Rating            - User ratings & reviews
--   8. Comment           - Comments with nested replies
--   9. Notification      - User notifications
--  10. AnalyticsEvent    - Real-time analytics
--  11. _prisma_migrations- Prisma migration tracking
-- =====================================================
