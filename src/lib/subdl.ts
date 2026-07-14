/**
 * src/lib/subdl.ts
 *
 * SubDL API integration untuk subtitle Indonesia.
 * Alur:
 *   1. Search subtitle by film name (pakai API key)
 *   2. Filter subtitle Indonesia
 *   3. Download SRT content (anonymous, trick URL)
 *   4. Cache ke D1 (TTL 7 hari)
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";

const SUBDL_API_BASE = "https://subdl.com/api/1.0";
const SUBDL_WEB_BASE = "https://subdl.com";
const CACHE_TTL_DAYS = 7;

// ============================================================
// D1 Helpers
// ============================================================
async function getD1(): Promise<D1Database> {
  const ctx = await getCloudflareContext();
  if (!ctx?.env?.DB) throw new Error("D1 not available");
  return ctx.env.DB as D1Database;
}

// ============================================================
// Hash cache key
// ============================================================
async function hashKey(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ============================================================
// Search SubDL API
// ============================================================
interface SubDLResult {
  release_name: string;
  name?: string;
  lang: string;
  lang_code?: string;
  link?: string;
  url?: string;
  author?: string;
  flag?: string;
}

export async function searchSubdlSubtitles(
  filmName: string,
  apiKey: string
): Promise<SubDLResult[]> {
  const url = `${SUBDL_API_BASE}/subtitles/search?api_key=${apiKey}&film_name=${encodeURIComponent(filmName)}`;
  console.log("[SubDL] Search:", url.replace(apiKey, "***"));

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept": "application/json",
    },
  });

  if (!res.ok) {
    console.error("[SubDL] Search failed:", res.status);
    return [];
  }

  const data = await res.json();
  return (data.result || []) as SubDLResult[];
}

// ============================================================
// Filter Indonesian subtitles
// ============================================================
export function filterIndonesianSubtitles(results: SubDLResult[]): SubDLResult[] {
  return results.filter((r) => {
    const lang = (r.lang || "").toLowerCase();
    const langCode = (r.lang_code || "").toLowerCase();
    return (
      lang.includes("indonesian") ||
      lang.includes("indonesia") ||
      lang === "id" ||
      langCode === "id" ||
      langCode === "ind"
    );
  });
}

// ============================================================
// Download SRT content (anonymous, trick URL)
// ============================================================
// SubDL punya 2 jenis URL:
//   1. API URL: https://subdl.com/api/1.0/subtitles/{id}?api_key=KEY (butuh auth)
//   2. Web URL: https://subdl.com/subtitle/{id}-{slug} (anonymous page)
//
// Trick: convert API URL atau link ke direct download URL
// SubDL direct download pattern: https://subdl.com/subtitle/{id}-{slug}.srt
export async function downloadSubdlSrt(
  result: SubDLResult,
  apiKey: string
): Promise<string | null> {
  // ============================================================
  // Strategy 1: Coba direct URL dari response
  // ============================================================
  let downloadUrl = result.url || result.link;
  if (!downloadUrl) return null;

  // Convert page URL ke .srt direct download
  if (downloadUrl.includes("/subtitle/") && !downloadUrl.endsWith(".srt")) {
    downloadUrl = downloadUrl.replace(/\/?$/, ".srt");
  }

  // ============================================================
  // Strategy 2: Anonymous fetch (tanpa API key)
  // ============================================================
  console.log("[SubDL] Download:", downloadUrl.replace(apiKey, "***"));

  try {
    const res = await fetch(downloadUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/plain,text/srt,application/octet-stream,*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": SUBDL_WEB_BASE + "/",
      },
      redirect: "follow",
    });

    if (!res.ok) {
      console.warn("[SubDL] Download failed:", res.status);
      return null;
    }

    const text = await res.text();

    // Validate: pastikan ini SRT (bukan HTML error page)
    if (text.length < 50 || text.includes("<!DOCTYPE html>") || text.includes("<html")) {
      console.warn("[SubDL] Response bukan SRT (HTML page)");
      return null;
    }

    return text;
  } catch (err) {
    console.error("[SubDL] Download error:", err);
    return null;
  }
}

// ============================================================
// SRT → VTT converter (browser compatibility)
// ============================================================
export function srtToVtt(srt: string): string {
  return (
    "WEBVTT\n\n" +
    srt
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      // Convert timestamps: 00:00:01,500 → 00:00:01.500
      .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2")
  );
}

// ============================================================
// Cache ke D1
// ============================================================
export async function cacheSubtitle(data: {
  cacheKey: string;
  title: string;
  type: string;
  season?: string;
  episode?: string;
  subtitleText: string;
  sourceUrl?: string;
  releaseName?: string;
}): Promise<void> {
  const d1 = await getD1();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + CACHE_TTL_DAYS);

  await d1
    .prepare(
      `INSERT OR REPLACE INTO subdl_subtitle_cache
        (cache_key, title, type, season, episode, subtitle_text, source_url, release_name, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      data.cacheKey,
      data.title,
      data.type,
      data.season || null,
      data.episode || null,
      data.subtitleText,
      data.sourceUrl || null,
      data.releaseName || null,
      expiresAt.toISOString()
    )
    .run();
}

// ============================================================
// Get dari cache
// ============================================================
export async function getCachedSubtitle(
  cacheKey: string
): Promise<string | null> {
  const d1 = await getD1();
  const result = await d1
    .prepare(
      `SELECT subtitle_text FROM subdl_subtitle_cache
       WHERE cache_key = ? AND expires_at > datetime('now')
       LIMIT 1`
    )
    .bind(cacheKey)
    .all<{ subtitle_text: string }>();

  return result.results[0]?.subtitle_text || null;
}

// ============================================================
// Invalidate cache by title (untuk auto-replace saat quality update)
// ============================================================
export async function invalidateCacheByTitle(
  title: string,
  type: string
): Promise<void> {
  const d1 = await getD1();
  await d1
    .prepare(`DELETE FROM subdl_subtitle_cache WHERE title = ? AND type = ?`)
    .bind(title, type)
    .run();
}

// ============================================================
// MAIN: Get Indonesian subtitle untuk media
// ============================================================
export async function getIndonesianSubtitle(params: {
  title: string;
  type: "movie" | "tv";
  season?: string;
  episode?: string;
  apiKey: string;
}): Promise<{ text: string; format: "srt" | "vtt" } | null> {
  const { title, type, season, episode, apiKey } = params;

  // Build cache key
  const keyParts = [title.toLowerCase().trim(), type];
  if (season) keyParts.push(`s${season}`);
  if (episode) keyParts.push(`e${episode}`);
  const cacheKey = await hashKey(keyParts.join("|"));

  // 1. Check cache
  const cached = await getCachedSubtitle(cacheKey);
  if (cached) {
    console.log("[SubDL] Cache HIT for:", title);
    return { text: cached, format: "srt" };
  }

  // 2. Search SubDL
  // Build search query
  let searchQuery = title;
  if (type === "tv" && season && episode) {
    searchQuery = `${title} S${season.padStart(2, "0")}E${episode.padStart(2, "0")}`;
  }

  console.log("[SubDL] Searching for:", searchQuery);
  const results = await searchSubdlSubtitles(searchQuery, apiKey);
  if (results.length === 0) {
    console.log("[SubDL] No results");
    return null;
  }

  // 3. Filter Indonesian
  const indoSubs = filterIndonesianSubtitles(results);
  if (indoSubs.length === 0) {
    console.log("[SubDL] No Indonesian subtitles found");
    return null;
  }

  console.log(`[SubDL] Found ${indoSubs.length} Indonesian subtitles`);

  // 4. Try download (loop sampai dapet yang valid)
  for (const sub of indoSubs) {
    const srtContent = await downloadSubdlSrt(sub, apiKey);
    if (srtContent) {
      // 5. Cache ke D1
      await cacheSubtitle({
        cacheKey,
        title,
        type,
        season,
        episode,
        subtitleText: srtContent,
        sourceUrl: sub.url || sub.link,
        releaseName: sub.release_name,
      });

      console.log("[SubDL] Successfully downloaded & cached:", sub.release_name);
      return { text: srtContent, format: "srt" };
    }
  }

  console.log("[SubDL] All Indonesian subtitles failed to download");
  return null;
}
