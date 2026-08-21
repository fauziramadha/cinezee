import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

const VPS_API_BASE = "https://api.cinestream.biz.id";

/**
 * Catch-all proxy route untuk VPS API.
 *
 * Semua request ke /api/vps/* akan di-proxy ke api.cinestream.biz.id/*
 *
 * CACHING STRATEGY (Cloudflare Cache API - FREE):
 * - /api/stream/play/:id (master m3u8): cache 300s (5 menit) - token expire ~1 jam
 * - /api/stream/info/:id (stream info JSON): cache 300s (5 menit)
 * - /api/content/* (content detail/list): cache 3600s (1 jam) - jarang berubah
 * - /api/home: cache 300s (5 menit) - sudah ada cache di VPS
 * - /api/search: cache 60s
 * - /api/image: cache 86400s (24 jam) - gambar tidak berubah
 * - POST requests: TIDAK di-cache (mutations)
 * - Non-200 responses: TIDAK di-cache
 */

export const dynamic = "force-dynamic";

function getCacheTtl(path: string): number {
  // Image proxy - cache lama (gambar tidak berubah)
  if (path.includes("/api/image")) return 86400; // 24 jam

  // Content detail/list - jarang berubah
  if (path.match(/\/api\/content\//)) return 3600; // 1 jam

  // Stream play (master m3u8) - token expire ~1 jam, cache 5 menit aman
  if (path.includes("/api/stream/play/")) return 300; // 5 menit

  // Stream info (JSON metadata) - cache 5 menit
  if (path.includes("/api/stream/info/")) return 300; // 5 menit

  // Home - cache 5 menit (VPS sudah cache juga)
  if (path.includes("/api/home")) return 300; // 5 menit

  // Search - cache 1 menit
  if (path.includes("/api/search")) return 60; // 1 menit

  // Default - 5 menit
  return 300;
}

function isCacheable(request: NextRequest, status: number): boolean {
  // Only cache GET requests
  if (request.method !== "GET") return false;

  // Only cache 200 OK
  if (status !== 200) return false;

  // Don't cache admin endpoints
  const path = request.nextUrl.pathname;
  if (path.includes("/admin/")) return false;

  // Don't cache subtitle endpoints (per-user watermarked)
  if (path.includes("/subtitle")) return false;

  return true;
}

export async function GET(request: NextRequest) {
  const path = request.nextUrl.pathname.replace("/api/vps/", "");
  const search = request.nextUrl.search;
  const targetUrl = `${VPS_API_BASE}/${path}${search}`;

  const cacheTtl = getCacheTtl(path);

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
    headers.set("Accept", "application/json, image/*, */*");

    const res = await fetch(targetUrl, {
      headers,
      redirect: "follow",
      signal: AbortSignal.timeout(25000),
    });

    const contentType = res.headers.get("content-type") || "application/json";

    const responseHeaders = new Headers({
      "Content-Type": contentType,
      "Cache-Control": `public, max-age=${cacheTtl}`,
      "Access-Control-Allow-Origin": "*",
    });

    // Forward relevant headers
    const xSubtitleSource = res.headers.get("X-Subtitle-Source");
    if (xSubtitleSource) {
      responseHeaders.set("X-Subtitle-Source", xSubtitleSource);
    }
    const xSubtitleWatermarked = res.headers.get("X-Subtitle-Watermarked");
    if (xSubtitleWatermarked) {
      responseHeaders.set("X-Subtitle-Watermarked", xSubtitleWatermarked);
    }
    const xSubtitleOffset = res.headers.get("X-Subtitle-Offset");
    if (xSubtitleOffset) {
      responseHeaders.set("X-Subtitle-Offset", xSubtitleOffset);
    }

    responseHeaders.set("X-Cache", "MISS");

    // Check if cacheable
    const shouldCache = isCacheable(request, res.status) && res.body;

    if (shouldCache) {
      // Use tee() to split stream: client + cache
      const [clientStream, cacheStream] = res.body.tee();

      const responseForCache = new NextResponse(cacheStream, {
        status: res.status,
        headers: responseHeaders,
      });

      // Cache in background
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

    // Non-cacheable: just stream
    const body = await res.arrayBuffer();
    return new NextResponse(body, {
      status: res.status,
      headers: responseHeaders,
    });
  } catch (error: any) {
    if (error.name !== "TimeoutError" && error.name !== "AbortError") {
      console.error("[VPS Proxy] Error:", error.message);
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

export async function POST(request: NextRequest) {
  const path = request.nextUrl.pathname.replace("/api/vps/", "");
  const search = request.nextUrl.search;
  const targetUrl = `${VPS_API_BASE}/${path}${search}`;

  try {
    const body = await request.text();

    const headers = new Headers({
      "Content-Type": request.headers.get("content-type") || "application/json",
      "User-Agent": "CineStream-Worker/1.0",
      "Accept": "application/json",
    });

    // Forward admin API key kalau ada
    const adminKey = request.headers.get("X-Admin-API-Key");
    if (adminKey) {
      headers.set("X-Admin-API-Key", adminKey);
    }

    const res = await fetch(targetUrl, {
      method: "POST",
      headers,
      body,
    });

    const data = await res.text();

    return new NextResponse(data, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("content-type") || "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    console.error("[VPS Proxy] POST Error:", error.message);
    return NextResponse.json(
      { error: "Failed to fetch from VPS API" },
      { status: 502 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Admin-API-Key",
    },
  });
}
