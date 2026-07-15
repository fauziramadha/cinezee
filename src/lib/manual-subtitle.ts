/**
 * src/lib/manual-subtitle.ts
 *
 * Manual subtitle management (admin upload, no expiry).
 * Subtitle disimpan di D1 sampai di-replace manual.
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";

async function getD1(): Promise<D1Database> {
  const ctx = await getCloudflareContext();
  if (!ctx?.env?.DB) throw new Error("D1 not available");
  return ctx.env.DB as D1Database;
}

export interface ManualSubtitle {
  id: number;
  title: string;
  type: string;
  season: string | null;
  episode: string | null;
  server: string | null;
  quality: string | null;
  subtitle_text: string;
  language: string;
  release_name: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================
// GET: Lookup subtitle by title/type/season/episode/server
// Priority: exact match > server=NULL fallback
// ============================================================
export async function getManualSubtitle(params: {
  title: string;
  type: string;
  season?: string;
  episode?: string;
  server?: string;
}): Promise<ManualSubtitle | null> {
  const d1 = await getD1();
  const { title, type, season, episode, server } = params;

  // Strategy 1: Exact match (title + type + season + episode + server)
  if (server) {
    const r1 = await d1
      .prepare(
        `SELECT * FROM manual_subtitles
         WHERE LOWER(title) = LOWER(?) AND type = ? AND season IS ? AND episode IS ? AND server = ?
         LIMIT 1`
      )
      .bind(title.trim(), type, season || null, episode || null, server)
      .all<ManualSubtitle>();
    if (r1.results[0]) return r1.results[0];
  }

  // Strategy 2: title + type + season + episode + server IS NULL (generic subtitle)
  const r2 = await d1
    .prepare(
      `SELECT * FROM manual_subtitles
       WHERE LOWER(title) = LOWER(?) AND type = ? AND season IS ? AND episode IS ? AND server IS NULL
       LIMIT 1`
    )
    .bind(title.trim(), type, season || null, episode || null)
    .all<ManualSubtitle>();
  if (r2.results[0]) return r2.results[0];

  // Strategy 3: title + type + server (untuk movie tanpa season/episode)
  if (server) {
    const r3 = await d1
      .prepare(
        `SELECT * FROM manual_subtitles
         WHERE LOWER(title) = LOWER(?) AND type = ? AND season IS NULL AND episode IS NULL AND server = ?
         LIMIT 1`
      )
      .bind(title.trim(), type, server)
      .all<ManualSubtitle>();
    if (r3.results[0]) return r3.results[0];
  }

  // Strategy 4: title + type + server IS NULL (generic movie subtitle)
  const r4 = await d1
    .prepare(
      `SELECT * FROM manual_subtitles
       WHERE LOWER(title) = LOWER(?) AND type = ? AND season IS NULL AND episode IS NULL AND server IS NULL
       LIMIT 1`
    )
    .bind(title.trim(), type)
    .all<ManualSubtitle>();

  return r4.results[0] || null;
}

// ============================================================
// UPSERT
// ============================================================
export async function upsertManualSubtitle(data: {
  title: string;
  type: string;
  season?: string;
  episode?: string;
  server?: string;
  quality?: string;
  subtitle_text: string;
  release_name?: string;
}): Promise<{ id: number; updated: boolean }> {
  const d1 = await getD1();
  const { title, type, season, episode, server, quality, subtitle_text, release_name } = data;

  const existing = await d1
    .prepare(
      `SELECT id FROM manual_subtitles
       WHERE LOWER(title) = LOWER(?) AND type = ? AND season IS ? AND episode IS ? AND server IS ?
       LIMIT 1`
    )
    .bind(title.trim(), type, season || null, episode || null, server || null)
    .all<{ id: number }>();

  if (existing.results[0]) {
    await d1
      .prepare(
        `UPDATE manual_subtitles SET
          quality = ?, subtitle_text = ?, release_name = ?, updated_at = datetime('now')
         WHERE id = ?`
      )
      .bind(quality || null, subtitle_text, release_name || null, existing.results[0].id)
      .run();
    return { id: existing.results[0].id, updated: true };
  }

  const result = await d1
    .prepare(
      `INSERT INTO manual_subtitles (title, type, season, episode, server, quality, subtitle_text, release_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      title.trim(), type, season || null, episode || null, server || null,
      quality || null, subtitle_text, release_name || null
    )
    .run();

  const newId = (result.meta as any)?.last_row_id as number;
  return { id: newId, updated: false };
}

// ============================================================
// LIST ALL (admin) — with optional search
// ============================================================
export async function listManualSubtitles(search?: string): Promise<ManualSubtitle[]> {
  const d1 = await getD1();
  if (search && search.trim()) {
    const result = await d1
      .prepare(
        `SELECT * FROM manual_subtitles
         WHERE LOWER(title) LIKE LOWER(?)
         ORDER BY updated_at DESC`
      )
      .bind(`%${search.trim()}%`)
      .all<ManualSubtitle>();
    return result.results || [];
  }
  const result = await d1
    .prepare(`SELECT * FROM manual_subtitles ORDER BY updated_at DESC`)
    .all<ManualSubtitle>();
  return result.results || [];
}

export async function deleteManualSubtitle(id: number): Promise<void> {
  const d1 = await getD1();
  await d1.prepare(`DELETE FROM manual_subtitles WHERE id = ?`).bind(id).run();
}

export function srtToVtt(srt: string): string {
  return (
    "WEBVTT\n\n" +
    srt
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2")
  );
}
