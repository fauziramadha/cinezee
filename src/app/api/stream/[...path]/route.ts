import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

const VPS_API_BASE = "https://api.cinestream.biz.id";

/**
 * Same-origin proxy untuk /api/stream/* endpoints.
 *
 * FLOW (optimized):
 *   Browser → Worker → VPS → s1.cccdn.net (direct, bypass easyproxy)
 *
 * VPS stream.js sudah di-patch untuk fetch langsung dari s1.cccdn.net,
 * mem-bypass easyproxy (Python single-threaded bottleneck).
 *
 * Worker tidak mencoba direct fetch ke s1.cccdn.net karena Cloudflare IPs
 * di-block oleh CDN (403 Forbidden). Hanya VPS IP yang di-allow.
 *
 * Caching: Cloudflare Cache API (FREE)
 * - TS segments: 24h (immutable)
 * - m3u8 playlists: 60s
 */

export const dynamic = "force-dynamic";

const PLAYLIST_CACHE_TTL = 60;
const SEGMENT_CACHE_TTL = 86400;

export async function GET(request: NextRequest) {
  const path = request.nextUrl.pathname.replace("/api/stream/", "");
  const search = request.nextUrl.search;
  const targetUrl = `${VPS_API_BASE}/api/stream/${path}${search}`;

  const hasSegmentParam = request.nextUrl.searchParams.has("p");
  const cacheTtl = hasSegmentParam ? SEGMENT_CACHE_TTL : PLAYLIST_CACHE_TTL;

  // Cloudflare Cache API
  const cacheKey = new Request(targetUrl, { method: "GET" });
  const cache = caches.default;

  // === CHECK CACHE FIRST ===
  const cached = await cache.match(cacheKey);
  if (cached) {
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
      res.headers.get("content-type") || "video/mp2t";

    const responseHeaders = new Headers({
      "Content-Type": contentType,
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": `public, max-age=${cacheTtl}`,
      "X-Cache": "MISS",
    });

    // Forward X-Source from VPS (CDN-DIRECT or easyproxy fallback)
    const xSource = res.headers.get("X-Source");
    if (xSource) {
      responseHeaders.set("X-Source", xSource);
    }

    // Forward critical headers
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

    // Only cache 200 OK (not 206 partial, not errors, not range requests)
    const isCacheable = res.ok && res.status === 200 && !range && res.body;

    if (isCacheable) {
      const [clientStream, cacheStream] = res.body.tee();
      const responseForCache = new NextResponse(cacheStream, {
        status: res.status,
        headers: responseHeaders,
      });

      try {
        const { ctx } = getCloudflareContext();
        ctx.waitUntil(cache.put(cacheKey, responseForCache));
      } catch {
        cache.put(cacheKey, responseForCache).catch(() => {});
      }

      return new NextResponse(clientStream, {
        status: res.status,
        headers: responseHeaders,
      });
    }

    // Non-cacheable: stream directly
    return new NextResponse(res.body, {
      status: res.status,
      headers: responseHeaders,
    });
  } catch (error: any) {
    if (error.name !== "TimeoutError" && error.name !== "AbortError") {
      console.error("[Stream Proxy] Error:", error.message);
    }
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
