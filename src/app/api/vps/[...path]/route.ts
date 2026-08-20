import { NextRequest, NextResponse } from "next/server";

const VPS_API_BASE = "https://api.cinestream.biz.id";

/**
 * Catch-all proxy route untuk VPS API.
 * 
 * Semua request ke /api/vps/* akan di-proxy ke api.cinestream.biz.id/*
 * 
 * Contoh:
 *   GET /api/vps/api/content/list?type=movie → api.cinestream.biz.id/api/content/list?type=movie
 *   GET /api/vps/api/stream/info/14 → api.cinestream.biz.id/api/stream/info/14
 *   GET /api/vps/api/image?url=... → api.cinestream.biz.id/api/image?url=...
 * 
 * Ini mengeliminasi masalah CORS dan Safari ITP (Intelligent Tracking Prevention)
 * yang block cross-origin request dari browser.
 * 
 * Worker fetch ke VPS API dari server-side (tidak ada CORS/ITP).
 */
export async function GET(request: NextRequest) {
  const path = request.nextUrl.pathname.replace("/api/vps/", "");
  const search = request.nextUrl.search;
  const targetUrl = `${VPS_API_BASE}/${path}${search}`;

  try {
    const headers = new Headers();
    headers.set("User-Agent", "CineStream-Worker/1.0");
    headers.set("Accept", "application/json, image/*, */*");

    const res = await fetch(targetUrl, {
      headers,
      redirect: "follow",
    });

    const contentType = res.headers.get("content-type") || "application/json";
    const body = await res.arrayBuffer();

    const responseHeaders = new Headers({
      "Content-Type": contentType,
      "Cache-Control": res.headers.get("cache-control") || "public, max-age=300",
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

    return new NextResponse(body, {
      status: res.status,
      headers: responseHeaders,
    });
  } catch (error: any) {
    console.error("[VPS Proxy] Error:", error.message);
    return NextResponse.json(
      { error: "Failed to fetch from VPS API" },
      { status: 502 }
    );
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
