import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

const VPS_API_BASE = "https://api.cinestream.biz.id";

/**
 * Stream proxy dengan Cloudflare Cache API (caches.default)
 *
 * KEY FIXES:
 * 1. Strip Range header - Safari sends Range for HLS segments
 *    VPS returns 206 (partial) if Range forwarded → can't cache
 *    Strip Range → VPS returns 200 OK → cacheable
 * 2. Use caches.default (Cache API) not cf: { cacheEverything }
 *    Cache API stores complete response at edge
 *    HIT = Worker doesn't process body = TTFB <100ms
 */

export const dynamic = "force-dynamic";

const PLAYLIST_CACHE_TTL = 60;
const SEGMENT_CACHE_TTL = 86400;

export async function GET(request: NextRequest) {
  const path = request.nextUrl.pathname.replace("/api/stream/", "");
  const search = request.nextUrl.search;
  const targetUrl = `${VPS_API_BASE}/api/stream/${path}${search}`;

  const hasSegmentParam = request.nextUrl.searchParams.has("p");
  const hasShortSegPath = path.startsWith("seg/");
  const isSegment = hasSegmentParam || hasShortSegPath;
  const cacheTtl = isSegment ? SEGMENT_CACHE_TTL : PLAYLIST_CACHE_TTL;

  const cache = caches.default;
  const cacheKey = new Request(targetUrl, { method: "GET" });

  // === CHECK CACHE FIRST ===
  const cached = await cache.match(cacheKey);
  if (cached) {
    const headers = new Headers(cached.headers);
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("X-Cache", "HIT-EDGE");
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
    // DO NOT forward Range header - causes 206 (uncacheable)
    // Safari sends Range for HLS segments, strip it so VPS returns 200 OK

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

    const xSource = res.headers.get("X-Source");
    if (xSource) {
      responseHeaders.set("X-Source", xSource);
    }

    const contentLength = res.headers.get("content-length");
    if (contentLength) {
      responseHeaders.set("Content-Length", contentLength);
    }

    // Cache ALL 200 OK responses (Range stripped, so always 200 not 206)
    const isCacheable = res.ok && res.status === 200 && res.body;

    if (isCacheable) {
      const resForCache = res.clone();

      const responseForCache = new NextResponse(resForCache.body, {
        status: resForCache.status,
        headers: responseHeaders,
      });

      try {
        const { ctx } = getCloudflareContext();
        ctx.waitUntil(cache.put(cacheKey, responseForCache));
      } catch {
        cache.put(cacheKey, responseForCache).catch(() => {});
      }

      return new NextResponse(res.body, {
        status: res.status,
        headers: responseHeaders,
      });
    }

    // Non-200: stream directly
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
