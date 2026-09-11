import { NextRequest, NextResponse } from "next/server";

const VPS_BASE = "https://api.cinestream.biz.id";
const INTERNAL_AUTH_SECRET = "cs1-internal-cfworker-bypass-7f3a9b2e8c1d";
const DEFAULT_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const encodedParam = url.searchParams.get("p");
  if (!encodedParam) return NextResponse.json({ error: "Missing 'p' parameter" }, { status: 400 });

  // The decoded URL is a VPS internal proxy path like:
  // /proxy/hls/manifest.m3u8?hls_url_id=u_BASE64&...&orig_url=https://s1.cccdn.net/...
  // We need to proxy back to VPS /api/stream/segment which handles CDN auth

  // Build the VPS segment URL
  const vpsSegmentUrl = `${VPS_BASE}/api/stream/segment?p=${encodedParam}`;

  // Build fetch headers
  const fetchHeaders: Record<string, string> = {
    "User-Agent": DEFAULT_UA,
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "X-Internal-Auth": INTERNAL_AUTH_SECRET,
  };

  const rangeHeader = request.headers.get("range");
  if (rangeHeader) fetchHeaders["Range"] = rangeHeader;

  // Fetch from VPS
  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(vpsSegmentUrl, { headers: fetchHeaders, redirect: "follow" });
  } catch (error) {
    console.error("[Stream Segment] Fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch segment" }, { status: 502 });
  }

  if (!upstreamResponse.ok) {
    const errorText = await upstreamResponse.text().catch(() => "");
    console.error(`[Stream Segment] VPS returned ${upstreamResponse.status}: ${errorText.substring(0, 200)}`);
    return NextResponse.json(
      { error: `VPS returned ${upstreamResponse.status}` },
      { status: upstreamResponse.status }
    );
  }

  // Build response headers
  const responseHeaders = new Headers();
  const ct = upstreamResponse.headers.get("content-type");
  if (ct) responseHeaders.set("Content-Type", ct);
  else responseHeaders.set("Content-Type", "application/octet-stream");

  const cl = upstreamResponse.headers.get("content-length");
  if (cl) responseHeaders.set("Content-Length", cl);

  const cr = upstreamResponse.headers.get("content-range");
  if (cr) responseHeaders.set("Content-Range", cr);

  responseHeaders.set("Accept-Ranges", "bytes");
  responseHeaders.set("Access-Control-Allow-Origin", "*");
  responseHeaders.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  responseHeaders.set("Access-Control-Allow-Headers", "Range, Content-Type");
  responseHeaders.set("Access-Control-Expose-Headers", "Content-Range, Content-Length");
  responseHeaders.set("Cache-Control", "public, max-age=86400");

  // For M3U8 responses, read text and rewrite URLs
  const contentType = ct || "";
  if (contentType.includes("mpegurl") || contentType.includes("m3u8")) {
    const text = await upstreamResponse.text();
    // Rewrite absolute VPS segment URLs to our Worker segment route
    let rewritten = text.replace(
      /https?:\/\/[^/]+\/api\/stream\/segment\?p=([^&\s"\\]+)/g,
      "/api/stream/segment?p=$1"
    );
    return new NextResponse(rewritten, { status: 200, headers: responseHeaders });
  }

  return new NextResponse(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers: responseHeaders,
  });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Range, Content-Type",
    "Access-Control-Max-Age": "86400",
  }});
}
