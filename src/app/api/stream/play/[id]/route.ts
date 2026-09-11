import { NextRequest, NextResponse } from "next/server";

const VPS_API_BASE = "https://api.cinestream.biz.id";
const INTERNAL_AUTH_SECRET = "cs1-internal-cfworker-bypass-7f3a9b2e8c1d";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const search = request.nextUrl.search;
  const targetUrl = `${VPS_API_BASE}/api/stream/play/${id}${search}`;

  try {
    const res = await fetch(targetUrl, {
      headers: { "User-Agent": "CineStream-Worker/1.0", "Accept": "*/*", "X-Internal-Auth": INTERNAL_AUTH_SECRET },
      redirect: "follow",
    });
    if (!res.ok) return NextResponse.json({ error: `VPS returned ${res.status}` }, { status: res.status });

    const contentType = res.headers.get("content-type") || "application/vnd.apple.mpegurl";
    const body = await res.text();

    // Rewrite absolute VPS segment URLs to our Worker segment route
    let rewritten = body.replace(
      /https?:\/\/[^/]+\/api\/stream\/segment\?p=([^&\s"\\]+)/g,
      "/api/stream/segment?p=$1"
    );

    return new NextResponse(rewritten, { status: res.status, headers: {
      "Content-Type": contentType, "Cache-Control": "public, max-age=60", "Access-Control-Allow-Origin": "*",
    }});
  } catch (error: any) {
    console.error("[Stream Play] Error:", error.message);
    return NextResponse.json({ error: "Failed to fetch from VPS" }, { status: 502 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: {
    "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Range, Content-Type",
  }});
}
