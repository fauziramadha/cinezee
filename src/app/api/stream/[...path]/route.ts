import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

const VPS_API_BASE = "https://api.cinestream.biz.id";

/**
 * Same-origin proxy untuk /api/stream/* endpoints di VPS.
 *
 * CACHING STRATEGY (Cloudflare Cache API - FREE):
 * - TS segments (immutable): cache 24 jam di Cloudflare edge
 * - m3u8 playlists (bisa berubah): cache 60 detik
 * - Range requests (206): TIDAK di-cache (partial content)
 * - Error responses (non-200): TIDAK di-cache
 *
 * Manfaat caching:
 * - User seek balik → instant (dari edge cache, 0ms latency)
 * - Multiple users nonton film yang sama → share cache (hemat VPS load)
 * - CDN cinemacity drop connection → retry bisa hit cache (no stuck)
 * - Reduces VPS load → VPS lebih responsive untuk request lain
 *
 * IMPLEMENTATION:
 * - res.clone() untuk duplicate response (1 untuk client, 1 untuk cache)
 * - ctx.waitUntil(cache.put()) untuk cache di background (tidak block client)
 * - Streaming response tetap dipertahankan (client dapat data secepat mungkin)
 */

export const dynamic = "force-dynamic";

// Cache TTLs (dalam detik)
const PLAYLIST_CACHE_TTL = 60; // 1 menit untuk m3u8 playlists
const SEGMENT_CACHE_TTL = 86400; // 24 jam untuk TS segments (immutable)

export async function GET(request: NextRequest) {
  const path = request.nextUrl.pathname.replace("/api/stream/", "");
  const search = request.nextUrl.search;
  const targetUrl = `${VPS_API_BASE}/api/stream/${path}${search}`;

  // Determine cache TTL based on content type
  // Segment requests have ?p= param, playlist requests have ?url= or ?hls_url_id=
  const hasSegmentParam = request.nextUrl.searchParams.has("p");
  const cacheTtl = hasSegmentParam ? SEGMENT_CACHE_TTL : PLAYLIST_CACHE_TTL;

  // Cloudflare Cache API
  const cacheKey = new Request(targetUrl, { method: "GET" });
  const cache = caches.default;

  // === CHECK CACHE FIRST ===
  const cached = await cache.match(cacheKey);
  if (cached) {
    // Return cached response with CORS + cache hit header
    const headers = new Headers(cached.headers);
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("X-Cache", "HIT");
    return new NextResponse(cached.body, {
      status: cached.status,
      headers,
    });
  }

  // === CACHE MISS - FETCH FROM VPS ===
  try {
    const headers = new Headers();
    headers.set("User-Agent", "CineStream-Worker/1.0");
    headers.set("Accept", "*/*");
    // Forward Range header untuk video segment seek
    const range = request.headers.get("range");
    if (range) {
      headers.set("Range", range);
    }

    const res = await fetch(targetUrl, {
      headers,
      redirect: "follow",
      signal: AbortSignal.timeout(25000),
    });

    const contentType =
      res.headers.get("content-type") || "video/mp2t; charset=utf-8";

    const responseHeaders = new Headers({
      "Content-Type": contentType,
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": `public, max-age=${cacheTtl}`,
    });

    // Forward critical headers for video streaming
    const contentLength = res.headers.get("content-length");
    if (contentLength) {
      responseHeaders.set("Content-Length", contentLength);
    }
    const contentRange = res.headers.get("content-range");
    if (contentRange) {
      responseHeaders.set("Content-Range", contentRange);
      responseHeaders.set("Accept-Ranges", "bytes");
    }
    const acceptRanges = res.headers.get("accept-ranges");
    if (acceptRanges) {
      responseHeaders.set("Accept-Ranges", acceptRanges);
    }
    const etag = res.headers.get("etag");
    if (etag) {
      responseHeaders.set("ETag", etag);
    }
    responseHeaders.set("X-Cache", "MISS");

    // Only cache 200 OK responses (not 206 partial, not errors, not range requests)
    const isCacheable = res.ok && res.status === 200 && !range;

    if (isCacheable && res.body) {
      // Use tee() to split the stream: 1 for client, 1 for cache
      // This is more reliable than res.clone() which can cause race conditions
      const [clientStream, cacheStream] = res.body.tee();

      // Create response for cache (will be consumed by cache.put)
      const responseForCache = new NextResponse(cacheStream, {
        status: res.status,
        headers: responseHeaders,
      });

      // Cache in background using waitUntil (doesn't block client response)
      try {
        const { ctx } = getCloudflareContext();
        ctx.waitUntil(cache.put(cacheKey, responseForCache));
      } catch {
        // Fallback: fire and forget
        cache.put(cacheKey, responseForCache).catch(() => {});
      }

      // Stream to client immediately
      return new NextResponse(clientStream, {
        status: res.status,
        headers: responseHeaders,
      });
    }

    // Non-cacheable (206 partial, error, range request): just stream
    return new NextResponse(res.body, {
      status: res.status,
      headers: responseHeaders,
    });
  } catch (error: any) {
    // Jangan log timeout errors (terlalu noisy)
    if (error.name !== "TimeoutError" && error.name !== "AbortError") {
      console.error("[Stream Proxy] Error:", error.message);
    }
    // Return 502 supaya hls.js retry
    return new NextResponse(null, {
      status: 502,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
      },
    });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Range",
    },
  });
}
