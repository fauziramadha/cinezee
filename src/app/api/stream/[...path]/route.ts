import { NextRequest, NextResponse } from "next/server";

const VPS_API_BASE = "https://api.cinestream.biz.id";

/**
 * Same-origin proxy untuk /api/stream/* endpoints di VPS.
 *
 * KENAPA INI DIBUTUHKAN:
 * - VPS API (api.cinestream.biz.id/api/stream/play/:id) mengembalikan m3u8 playlist
 * - Playlist berisi segment URLs dalam bentuk RELATIF: /api/stream/segment?p=...
 * - hls.js resolve URL relatif terhadap origin halaman (cinestream.biz.id)
 * - Tanpa proxy ini, segment URLs resolve ke cinestream.biz.id/api/stream/segment → 404
 * - hls.js retry forever → player stuck loading
 *
 * Dengan proxy ini, segment URLs resolve ke cinestream.biz.id/api/stream/segment
 * → diteruskan ke api.cinestream.biz.id/api/stream/segment → 200 OK
 *
 * Endpoint yang lewat sini:
 * - /api/stream/segment?p=<base64>  → TS video segments (streaming, tidak load ke memori)
 * - /api/stream/playlist/:id        → sub-playlist (kalau ada)
 *
 * PERFORMANCE FIX:
 * - Gunakan streaming response (body passthrough) BUKAN arrayBuffer()
 * - arrayBuffer() load seluruh segment (1-2MB) ke memori Worker → CPU spike → timeout
 * - Streaming: chunk langsung diteruskan dari VPS ke client → CPU minimal
 * - Tambah AbortSignal.timeout(25s) supaya Worker tidak hang jika VPS lambat
 *
 * Note: /api/stream/play/:id (master m3u8) masih lewat /api/vps/api/stream/play/:id
 * karena dipanggil langsung dari player-modal.tsx.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const path = request.nextUrl.pathname.replace("/api/stream/", "");
  const search = request.nextUrl.search;
  const targetUrl = `${VPS_API_BASE}/api/stream/${path}${search}`;

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
      // Timeout 25s - jika VPS/easyproxy lambat, Worker tidak akan hang
      // Cloudflare Worker wall clock limit 30s, jadi 25s aman
      signal: AbortSignal.timeout(25000),
    });

    const contentType =
      res.headers.get("content-type") ||
      "video/mp2t; charset=utf-8";

    const responseHeaders = new Headers({
      "Content-Type": contentType,
      "Access-Control-Allow-Origin": "*",
      "Cache-Control":
        res.headers.get("cache-control") || "public, max-age=3600",
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

    // STREAMING: Pass body langsung dari VPS ke client
    // Tidak load ke memori Worker → CPU time minimal → no timeout
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
