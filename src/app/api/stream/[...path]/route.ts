import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

const VPS_API_BASE = "https://api.cinestream.biz.id";

/**
 * OPTIMIZED stream proxy with prefetch
 *
 * When sub-playlist (m3u8) is fetched, prefetch first 10 segments
 * to warm edge cache. This eliminates buffer underrun on first play.
 */

export const dynamic = "force-dynamic";

const PLAYLIST_CACHE_TTL = 60;
const SEGMENT_CACHE_TTL = 86400;

async function prefetchSegments(playlistText: string): Promise<void> {
  // DISABLED - prefetch was causing Worker CPU overload (Error 1102)
  // Safari native HLS handles buffering natively and more efficiently
  return;
}

export async function GET(request: NextRequest) {
  const path = request.nextUrl.pathname.replace("/api/stream/", "");
  const search = request.nextUrl.search;
  const targetUrl = `${VPS_API_BASE}/api/stream/${path}${search}`;

  const hasSegmentParam = request.nextUrl.searchParams.has("p");
  const hasShortSegPath = path.startsWith("seg/");
  const isSegment = hasSegmentParam || hasShortSegPath;
  const cacheTtl = isSegment ? SEGMENT_CACHE_TTL : PLAYLIST_CACHE_TTL;

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
      cf: {
        cacheTtl: cacheTtl,
        cacheEverything: true,
      },
    });

    const contentType =
      res.headers.get("content-type") || "video/mp2t";

    const responseHeaders = new Headers({
      "Content-Type": contentType,
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": `public, max-age=${cacheTtl}`,
      "X-Cache": res.headers.get("cf-cache-status") || "DYNAMIC",
    });

    const xSource = res.headers.get("X-Source");
    if (xSource) {
      responseHeaders.set("X-Source", xSource);
    }

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

    const isM3U8 =
      contentType.includes("mpegurl") ||
      contentType.includes("m3u8");

    if (isM3U8) {
      const bodyText = await res.text();

      try {
        const { ctx } = getCloudflareContext();
        ctx.waitUntil(prefetchSegments(bodyText));
      } catch {
        prefetchSegments(bodyText).catch(() => {});
      }

      return new NextResponse(bodyText, {
        status: res.status,
        headers: responseHeaders,
      });
    }

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
