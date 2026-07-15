/**
 * src/lib/subdl.ts
 *
 * SubDL API integration untuk subtitle Indonesia.
 *
 * Alur:
 *   1. Search subtitle (Strategy 1: direct, Strategy 2: multiple proxies dengan retry)
 *   2. Filter manual: cari yang language === "ID"
 *   3. Download ZIP file (Strategy 1: direct, Strategy 2: via proxy + base64 decode)
 *   4. Unzip + clean HTML tags
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
// CORS PROXY — bypass SubDL IP block (Cloudflare Workers di-block 403)
// Pakai multiple proxy dengan retry mechanism (allorigins kadang intermittent)
// ============================================================
const CORS_PROXIES = [
  "https://api.allorigins.win/raw?url=",
  "https://api.allorigins.win/get?url=",
  "https://corsproxy.io/?url=",
];

const CORS_PROXY_GET = "https://api.allorigins.win/get?url=";

function buildProxyUrl(targetUrl: string, proxyIdx: number = 0): string {
  return CORS_PROXIES[proxyIdx] + encodeURIComponent(targetUrl);
}

// Fetch dengan retry (3x per proxy, 3 proxies = max 9 attempts)
async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries: number = 3
): Promise<Response | null> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
      console.warn(`[Proxy] Attempt ${attempt}/${maxRetries} failed: ${res.status}`);
    } catch (err) {
      console.warn(`[Proxy] Attempt ${attempt}/${maxRetries} error:`, err);
    }
    // Delay sebelum retry (1s, 2s, 3s)
    if (attempt < maxRetries) {
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
  return null;
}

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
  const directUrl = `${SUBDL_API_BASE}?api_key=${apiKey}&film_name=${encodeURIComponent(filmName)}`;
  console.log("[SubDL] Search:", directUrl.replace(apiKey, "***"));

  // ============================================================
  // Strategy 1: Direct fetch (cepat, kalau Worker IP gak di-block)
  // ============================================================
  try {
    const directRes = await fetch(directUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json",
      },
    });
    if (directRes.ok) {
      const data = await directRes.json();
      console.log("[SubDL] Direct search OK:", (data.subtitles || []).length, "results");
      return (data.subtitles || []) as SubDLResult[];
    }
    console.warn("[SubDL] Direct search failed:", directRes.status);
  } catch (err) {
    console.warn("[SubDL] Direct search error:", err);
  }

  // ============================================================
  // Strategy 2: Via proxy dengan retry (3x per proxy)
  // ============================================================
  console.log("[SubDL] Trying via proxy...");

  for (let proxyIdx = 0; proxyIdx < CORS_PROXIES.length; proxyIdx++) {
    const proxyUrl = buildProxyUrl(directUrl, proxyIdx);
    console.log(`[SubDL] Proxy ${proxyIdx + 1}/${CORS_PROXIES.length}:`, CORS_PROXIES[proxyIdx]);

    const res = await fetchWithRetry(
      proxyUrl,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "application/json",
        },
      },
      3 // 3 retries per proxy
    );

    if (!res) continue;

    try {
      const text = await res.text();

      // allorigins /raw returns JSON langsung
      // allorigins /get returns {"contents":"<json string>",...}
      let jsonString = text;
      try {
        const parsed = JSON.parse(text);
        if (parsed.contents && typeof parsed.contents === "string") {
          jsonString = parsed.contents;
        }
      } catch {}

      const data = JSON.parse(jsonString);
      if (data.subtitles) {
        console.log(`[SubDL] Proxy ${proxyIdx + 1} OK:`, data.subtitles.length, "results");
        return data.subtitles as SubDLResult[];
      }
    } catch (err) {
      console.warn(`[SubDL] Proxy ${proxyIdx + 1} parse error:`, err);
    }
  }

  console.error("[SubDL] All proxies failed");
  return [];
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
// Clean SRT — hapus HTML tags (font color, b, i, dll)
// SubDL sering ada subtitle dengan <font color="#xxx"> per karakter
// ============================================================
function cleanSrtHtml(srt: string): string {
  return srt
    .replace(/<font[^>]*>/gi, "")
    .replace(/<\/font>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();
}

// ============================================================
// Unzip ZIP file (extract .srt content)
// Pakai DecompressionStream('deflate-raw') yang available di Workers
// ============================================================
async function unzipSrtFromZip(zipBuffer: ArrayBuffer): Promise<string | null> {
  const view = new DataView(zipBuffer);
  const bytes = new Uint8Array(zipBuffer);

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
    decompressedBuffer = compressedData.buffer;
  } else if (compressionMethod === 8) {
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

  let text = new TextDecoder("utf-8").decode(decompressedBuffer);

  if (text.length < 50 || text.includes("<!DOCTYPE html>") || text.includes("<html")) {
    console.warn("[Unzip] Extracted content bukan SRT valid");
    return null;
  }

  if (text.includes("<font") || text.includes("<span") || text.includes("<div")) {
    console.log("[Unzip] Cleaning HTML tags from SRT...");
    text = cleanSrtHtml(text);
  }

  return text;
}

// ============================================================
// Download & Unzip subtitle (2 strategies: direct + proxy)
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

  let zipBuffer: ArrayBuffer | null = null;

  // ============================================================
  // Strategy 1: Direct fetch (cepat, kalau Worker IP gak di-block)
  // ============================================================
  try {
    const directRes = await fetch(downloadUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/zip,application/octet-stream,*/*",
        "Referer": SUBDL_WEB_BASE + "/",
      },
      redirect: "follow",
    });
    if (directRes.ok) {
      zipBuffer = await directRes.arrayBuffer();
      console.log("[SubDL] Direct download OK:", zipBuffer.byteLength, "bytes");
    }
  } catch (directErr) {
    console.warn("[SubDL] Direct download failed, trying proxy");
  }

  // ============================================================
  // Strategy 2: Via allorigins /get proxy dengan retry
  // Returns JSON: {"contents":"data:...;base64,..."}
  // ============================================================
  if (!zipBuffer) {
    const proxyUrl = CORS_PROXY_GET + encodeURIComponent(downloadUrl);
    console.log("[SubDL] Download via allorigins /get proxy (with retry)");

    const proxyRes = await fetchWithRetry(
      proxyUrl,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "application/json",
        },
      },
      5 // 5 retries (allorigins intermittent)
    );

    if (!proxyRes) {
      console.warn("[SubDL] Proxy download failed after retries");
      return null;
    }

    try {
      const proxyData = await proxyRes.json() as { contents?: string };
      if (!proxyData.contents) {
        console.warn("[SubDL] Proxy returned no contents");
        return null;
      }

      // Parse data URL: "data:application/octet-stream;base64,UEsDBBQ..."
      const dataUrl = proxyData.contents;
      const base64Match = dataUrl.match(/^data:[^;]*;base64,(.+)$/);
      if (!base64Match) {
        // Mungkin contents adalah text langsung (SRT)
        if (dataUrl.length > 50 && !dataUrl.includes("<!DOCTYPE html>")) {
          let text = dataUrl;
          if (text.includes("<font") || text.includes("<span")) {
            text = cleanSrtHtml(text);
          }
          return text;
        }
        console.warn("[SubDL] Proxy contents format unknown");
        return null;
      }

      // Decode base64 ke ArrayBuffer
      const base64Data = base64Match[1];
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      zipBuffer = bytes.buffer;
      console.log("[SubDL] Proxy download OK:", zipBuffer.byteLength, "bytes");
    } catch (proxyErr) {
      console.error("[SubDL] Proxy download error:", proxyErr);
      return null;
    }
  }

  if (!zipBuffer) {
    console.warn("[SubDL] All download strategies failed");
    return null;
  }

  // Cek apakah ini ZIP (PK signature)
  const view = new DataView(zipBuffer);
  if (view.getUint32(0, true) !== 0x04034b50) {
    // Bukan ZIP — mungkin langsung SRT
    let text = new TextDecoder("utf-8").decode(zipBuffer);
    if (text.length > 50 && !text.includes("<!DOCTYPE html>") && !text.includes("<html")) {
      if (text.includes("<font") || text.includes("<span")) {
        text = cleanSrtHtml(text);
      }
      return text;
    }
    console.warn("[SubDL] Response bukan ZIP dan bukan SRT");
    return null;
  }

  const srtText = await unzipSrtFromZip(zipBuffer);
  return srtText;
}

// ============================================================
// SRT → VTT converter
// ============================================================
export function srtToVtt(srt: string): string {
  const cleaned = cleanSrtHtml(srt);
  return (
    "WEBVTT\n\n" +
    cleaned
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
