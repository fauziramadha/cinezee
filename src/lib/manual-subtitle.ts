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
  offset_ms: number;
  created_at: string;
  updated_at: string;
}

// ============================================================
// GET: Lookup subtitle by title/type/season/episode/server
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

  const r2 = await d1
    .prepare(
      `SELECT * FROM manual_subtitles
       WHERE LOWER(title) = LOWER(?) AND type = ? AND season IS ? AND episode IS ? AND server IS NULL
       LIMIT 1`
    )
    .bind(title.trim(), type, season || null, episode || null)
    .all<ManualSubtitle>();
  if (r2.results[0]) return r2.results[0];

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
// GET by ID - untuk edit mode (FIX C: tambah function ini)
// ============================================================
export async function getManualSubtitleById(id: number): Promise<ManualSubtitle | null> {
  const d1 = await getD1();
  const result = await d1
    .prepare(`SELECT * FROM manual_subtitles WHERE id = ?`)
    .bind(id)
    .first<ManualSubtitle>();
  return result || null;
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
  offset_ms?: number;
}): Promise<{ id: number; updated: boolean }> {
  const d1 = await getD1();
  const { title, type, season, episode, server, quality, subtitle_text, release_name, offset_ms } = data;

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
          quality = ?, subtitle_text = ?, release_name = ?, offset_ms = ?, updated_at = datetime('now')
         WHERE id = ?`
      )
      .bind(quality || null, subtitle_text, release_name || null, offset_ms || 0, existing.results[0].id)
      .run();
    return { id: existing.results[0].id, updated: true };
  }

  const result = await d1
    .prepare(
      `INSERT INTO manual_subtitles (title, type, season, episode, server, quality, subtitle_text, release_name, offset_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      title.trim(), type, season || null, episode || null, server || null,
      quality || null, subtitle_text, release_name || null, offset_ms || 0
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

// ============================================================
// APPLY OFFSET: geser semua timestamp di SRT/VTT
// ============================================================
export function applySubtitleOffset(text: string, offsetMs: number): string {
  if (!offsetMs || offsetMs === 0) return text;

  const timestampPattern = /(\d{2}):(\d{2}):(\d{2})[.,](\d{3})/g;

  return text.replace(timestampPattern, (match, h, m, s, ms) => {
    const totalMs =
      Number(h) * 3600000 +
      Number(m) * 60000 +
      Number(s) * 1000 +
      Number(ms) +
      offsetMs;

    if (totalMs < 0) return "00:00:00,000";

    const newH = Math.floor(totalMs / 3600000);
    const newM = Math.floor((totalMs % 3600000) / 60000);
    const newS = Math.floor((totalMs % 60000) / 1000);
    const newMs = totalMs % 1000;

    const separator = match.includes(",") ? "," : ".";
    return (
      String(newH).padStart(2, "0") + ":" +
      String(newM).padStart(2, "0") + ":" +
      String(newS).padStart(2, "0") +
      separator +
      String(newMs).padStart(3, "0")
    );
  });
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
