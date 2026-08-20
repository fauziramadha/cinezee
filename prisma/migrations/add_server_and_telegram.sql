-- Add server field to manual_subtitles
ALTER TABLE manual_subtitles ADD COLUMN server TEXT;

-- Track cinemacity films for update notifications
CREATE TABLE IF NOT EXISTS cinemacity_film_updates (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  servers_json TEXT,
  first_seen TEXT NOT NULL DEFAULT (datetime('now')),
  last_checked TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_film_updates_last_checked ON cinemacity_film_updates(last_checked);
