/**
 * src/lib/subdl.ts
 *
 * SubDL API integration untuk subtitle Indonesia.
 *
 * Alur:
 *   1. Search subtitle by film name (API language filter gak bekerja, filter manual)
 *   2. Filter manual: cari yang language === "ID"
 *   3. Download ZIP file dari dl.subdl.com
 *   4. Unzip (extract .srt dari dalam ZIP)
 *   5. Cache ke D1 (TTL 7 hari)
 *
 * API: https://api.subdl.com/api/v1/subtitles
 * Download: https://dl.subdl.com/subtitle/{id}-{id} (returns ZIP)
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";

const SUBDL_API_BASE = "https://api.subdl.com/api/v1/subtitles";
const SUBDL_DL_BASE = "https://dl.subdl.com/subtitle";
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

async function hashKey(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ============================================================
// Search SubDL API
// NOTE: language filter di API TIDAK BEKERJA (tetap return semua bahasa)
// Filter manual di client side (di getIndonesianSubtitle)
// ============================================================
interface SubDLResult {
  release_name: string;
  name?: string;
  lang: string;
  language: string; // "ID", "EN", "FA", dll
  url: string;      // "/subtitle/3312671-10001056.zip?api_key=..."
  author?: string;
  season?: number;
  episode?: number | null;
}

export async function searchSubdlSubtitles(
  filmName: string,
  apiKey: string
): Promise<SubDLResult[]> {
  const url = `${SUBDL_API_BASE}?api_key=${apiKey}&film_name=${encodeURIComponent(filmName)}`;
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
  // Response field: "subtitles" (bukan "result")
  return (data.subtitles || []) as SubDLResult[];
}

// ============================================================
// Filter Indonesian subtitles (manual — API filter gak bekerja)
// ============================================================
export function filterIndonesian(results: SubDLResult[]): SubDLResult[] {
  return results.filter(
    (s) =>
      s.language === "ID" ||
      s.lang?.toLowerCase().includes("indonesian") ||
      s.lang?.toLowerCase().includes("indonesia")
  );
}

// ============================================================
// Extract download URL dari SubDL result
// /subtitle/3312671-10001056.zip?api_key=... → https://dl.subdl.com/subtitle/3312671-10001056
// ============================================================
function extractDownloadUrl(resultUrl: string): string | null {
  const match = resultUrl.match(/\/subtitle\/(\d+-\d+)/);
  if (!match) return null;
  return `${SUBDL_DL_BASE}/${match[1]}`;
}

// ============================================================
// Unzip ZIP file (extract .srt content)
// Pakai DecompressionStream('deflate-raw') yang available di Workers
// ============================================================
async function unzipSrtFromZip(zipBuffer: ArrayBuffer): Promise<string | null> {
  const view = new DataView(zipBuffer);
  const bytes = new Uint8Array(zipBuffer);

  // Parse Local File Header (PK\x03\x04)
  if (view.getUint32(0, true) !== 0x04034b50) {
    console.error("[Unzip] Invalid ZIP signature");
    return null;
  }

  const compressionMethod = view.getUint16(8, true);
  let compressedSize = view.getUint32(18, true);
  const filenameLength = view.getUint16(26, true);
  const extraFieldLength = view.getUint16(28, true);
  const dataOffset = 30 + filenameLength + extraFieldLength;

  const filename = new TextDecoder().decode(bytes.slice(30, 30 + filenameLength));
  console.log(`[Unzip] File: ${filename}, method: ${compressionMethod}, compressed: ${compressedSize}`);

  if (!filename.toLowerCase().endsWith(".srt")) {
    console.warn("[Unzip] First file bukan .srt:", filename);
  }

  // Kalau compressed size = 0 (data descriptor used), cari end signature
  if (compressedSize === 0) {
    for (let i = dataOffset; i < zipBuffer.byteLength - 4; i++) {
      if (
        bytes[i] === 0x50 &&
        bytes[i + 1] === 0x4b &&
        bytes[i + 2] === 0x01 &&
        bytes[i + 3] === 0x02
      ) {
        compressedSize = i - dataOffset;
        break;
      }
    }
  }

  if (compressedSize === 0) {
    console.error("[Unzip] Cannot determine compressed size");
    return null;
  }

  const compressedData = bytes.slice(dataOffset, dataOffset + compressedSize);

  let decompressedBuffer: ArrayBuffer;

  if (compressionMethod === 0) {
    // Store (no compression)
    decompressedBuffer = compressedData.buffer;
  } else if (compressionMethod === 8) {
    // Deflate
    try {
      const ds = new DecompressionStream("deflate-raw");
      const blob = new Blob([compressedData]);
      const decompressed = blob.stream().pipeThrough(ds);
      const result = await new Response(decompressed).arrayBuffer();
      decompressedBuffer = result;
    } catch (err) {
      console.error("[Unzip] Deflate decompression failed:", err);
      return null;
    }
  } else {
    console.error("[Unzip] Unsupported compression method:", compressionMethod);
    return null;
  }

  const text = new TextDecoder("utf-8").decode(decompressedBuffer);

  if (text.length < 50 || text.includes("<!DOCTYPE html>")) {
    console.warn("[Unzip] Extracted content bukan SRT valid");
    return null;
  }

  return text;
}

// ============================================================
// Download & Unzip subtitle
// ============================================================
export async function downloadSubdlSrt(
  result: SubDLResult
): Promise<string | null> {
  const downloadUrl = extractDownloadUrl(result.url);
  if (!downloadUrl) {
    console.warn("[SubDL] Cannot extract download URL from:", result.url);
    return null;
  }

  console.log("[SubDL] Download ZIP:", downloadUrl);

  try {
    const res = await fetch(downloadUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/zip,application/octet-stream,*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": SUBDL_WEB_BASE + "/",
      },
      redirect: "follow",
    });

    if (!res.ok) {
      console.warn("[SubDL] Download failed:", res.status);
      return null;
    }

    const zipBuffer = await res.arrayBuffer();

    const view = new DataView(zipBuffer);
    if (view.getUint32(0, true) !== 0x04034b50) {
      // Bukan ZIP — mungkin langsung SRT
      const text = new TextDecoder("utf-8").decode(zipBuffer);
      if (text.length > 50 && !text.includes("<!DOCTYPE html>")) {
        return text;
      }
      console.warn("[SubDL] Response bukan ZIP dan bukan SRT");
      return null;
    }

    const srtText = await unzipSrtFromZip(zipBuffer);
    return srtText;
  } catch (err) {
    console.error("[SubDL] Download error:", err);
    return null;
  }
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

export async function getCachedSubtitle(cacheKey: string): Promise<string | null> {
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

export async function invalidateCacheByTitle(title: string, type: string): Promise<void> {
  const d1 = await getD1();
  await d1
    .prepare(`DELETE FROM subdl_subtitle_cache WHERE title = ? AND type = ?`)
    .bind(title, type)
    .run();
}

// ============================================================
// MAIN: Get Indonesian subtitle
// ============================================================
export async function getIndonesianSubtitle(params: {
  title: string;
  type: "movie" | "tv";
  season?: string;
  episode?: string;
  apiKey: string;
}): Promise<{ text: string; format: "srt" } | null> {
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

  // 2. Search SubDL (TANPA language filter — filter manual di bawah)
  let searchQuery = title;
  if (type === "tv" && season && episode) {
    searchQuery = `${title} S${season.padStart(2, "0")}E${episode.padStart(2, "0")}`;
  }

  console.log("[SubDL] Searching for:", searchQuery);
  const allResults = await searchSubdlSubtitles(searchQuery, apiKey);
  if (allResults.length === 0) {
    console.log("[SubDL] No results from API");
    return null;
  }

  // ============================================================
  // FILTER MANUAL: cari yang language === "ID"
  // (SubDL API language filter gak bekerja, tetap return semua bahasa)
  // ============================================================
  const results = filterIndonesian(allResults);

  console.log(
    `[SubDL] Total results: ${allResults.length}, Indonesian: ${results.length}`
  );

  if (results.length === 0) {
    console.log("[SubDL] No Indonesian subtitles found");
    const langs = allResults.map((s) => `${s.language}/${s.lang}`).join(", ");
    console.log("[SubDL] Available languages:", langs);
    return null;
  }

  // 3. Try download (loop sampai dapet yang valid)
  for (const sub of results) {
    const srtContent = await downloadSubdlSrt(sub);
    if (srtContent) {
      // 4. Cache ke D1
      await cacheSubtitle({
        cacheKey,
        title,
        type,
        season,
        episode,
        subtitleText: srtContent,
        sourceUrl: sub.url,
        releaseName: sub.release_name,
      });

      console.log("[SubDL] Successfully downloaded & cached:", sub.release_name);
      return { text: srtContent, format: "srt" };
    }
  }

  console.log("[SubDL] All Indonesian subtitles failed to download");
  return null;
}
