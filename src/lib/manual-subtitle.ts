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
  quality: string | null;
  subtitle_text: string;
  language: string;
  release_name: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================
// GET: Lookup subtitle by title/type/season/episode
// ============================================================
export async function getManualSubtitle(params: {
  title: string;
  type: string;
  season?: string;
  episode?: string;
}): Promise<ManualSubtitle | null> {
  const d1 = await getD1();
  const { title, type, season, episode } = params;

  // Exact match: title + type + season + episode
  let result = await d1
    .prepare(
      `SELECT * FROM manual_subtitles
       WHERE LOWER(title) = LOWER(?) AND type = ? AND season = ? AND episode = ?
       LIMIT 1`
    )
    .bind(title.trim(), type, season || null, episode || null)
    .all<ManualSubtitle>();

  if (result.results[0]) return result.results[0];

  // Fallback: title + type only (untuk movie, atau TV tanpa season/episode spesifik)
  result = await d1
    .prepare(
      `SELECT * FROM manual_subtitles
       WHERE LOWER(title) = LOWER(?) AND type = ? AND season IS NULL AND episode IS NULL
       LIMIT 1`
    )
    .bind(title.trim(), type)
    .all<ManualSubtitle>();

  return result.results[0] || null;
}

// ============================================================
// UPSERT: Insert or update by title/type/season/episode
// ============================================================
export async function upsertManualSubtitle(data: {
  title: string;
  type: string;
  season?: string;
  episode?: string;
  quality?: string;
  subtitle_text: string;
  release_name?: string;
}): Promise<{ id: number; updated: boolean }> {
  const d1 = await getD1();
  const { title, type, season, episode, quality, subtitle_text, release_name } = data;

  // Cek existing
  const existing = await d1
    .prepare(
      `SELECT id FROM manual_subtitles
       WHERE LOWER(title) = LOWER(?) AND type = ? AND season IS ? AND episode IS ?
       LIMIT 1`
    )
    .bind(title.trim(), type, season || null, episode || null)
    .all<{ id: number }>();

  if (existing.results[0]) {
    // Update existing (replace subtitle text)
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

  // Insert new
  const result = await d1
    .prepare(
      `INSERT INTO manual_subtitles (title, type, season, episode, quality, subtitle_text, release_name)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      title.trim(),
      type,
      season || null,
      episode || null,
      quality || null,
      subtitle_text,
      release_name || null
    )
    .run();

  const newId = (result.meta as any)?.last_row_id as number;
  return { id: newId, updated: false };
}

// ============================================================
// LIST ALL (admin)
// ============================================================
export async function listManualSubtitles(): Promise<ManualSubtitle[]> {
  const d1 = await getD1();
  const result = await d1
    .prepare(`SELECT * FROM manual_subtitles ORDER BY updated_at DESC`)
    .all<ManualSubtitle>();
  return result.results || [];
}

// ============================================================
// DELETE by id
// ============================================================
export async function deleteManualSubtitle(id: number): Promise<void> {
  const d1 = await getD1();
  await d1.prepare(`DELETE FROM manual_subtitles WHERE id = ?`).bind(id).run();
}

// ============================================================
// SRT → VTT converter
// ============================================================
export function srtToVtt(srt: string): string {
  return (
    "WEBVTT\n\n" +
    srt
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2")
  );
}
