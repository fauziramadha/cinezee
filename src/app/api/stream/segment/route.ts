import { NextRequest, NextResponse } from "next/server";

const ALLOWED_DOMAINS = ["s1.cccdn.net", "s2.cccdn.net", "s3.cccdn.net", "cinemacity.cc", "api.cinestream.biz.id"];
const DEFAULT_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const VPS_BASE = "https://api.cinestream.biz.id";
const INTERNAL_AUTH_SECRET = "cs1-internal-cfworker-bypass-7f3a9b2e8c1d";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const encodedParam = url.searchParams.get("p");
  if (!encodedParam) return NextResponse.json({ error: "Missing 'p' parameter" }, { status: 400 });

  // Decode base64 parameter
  let decodedUrl: string;
  try { decodedUrl = Buffer.from(encodedParam, "base64").toString("utf-8"); }
  catch { return NextResponse.json({ error: "Invalid base64 parameter" }, { status: 400 }); }

  // If decoded URL is relative (starts with /), prefix with VPS base URL
  let streamUrl: string;
  if (decodedUrl.startsWith("/")) {
    streamUrl = `${VPS_BASE}${decodedUrl}`;
  } else if (decodedUrl.startsWith("http")) {
    streamUrl = decodedUrl;
  } else {
    return NextResponse.json({ error: "Invalid stream URL format" }, { status: 400 });
  }

  // Parse the URL
  let parsedUrl: URL;
  try { parsedUrl = new URL(streamUrl); }
  catch { return NextResponse.json({ error: "Invalid stream URL" }, { status: 400 }); }

  // Check domain whitelist
  const isAllowed = ALLOWED_DOMAINS.some((d) => parsedUrl.hostname === d || parsedUrl.hostname.endsWith(`.${d}`));
  if (!isAllowed) return NextResponse.json({ error: `Domain not allowed: ${parsedUrl.hostname}` }, { status: 403 });

  // Build fetch headers
  const fetchHeaders: Record<string, string> = {
    "User-Agent": DEFAULT_UA, "Accept": "*/*", "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://cinemacity.cc/", "Origin": "https://cinemacity.cc",
  };
  // Add auth header for VPS requests
  if (parsedUrl.hostname === "api.cinestream.biz.id") {
    fetchHeaders["X-Internal-Auth"] = INTERNAL_AUTH_SECRET;
  }

  const rangeHeader = request.headers.get("range");
  if (rangeHeader) fetchHeaders["Range"] = rangeHeader;

  // Fetch
  let upstreamResponse: Response;
  try { upstreamResponse = await fetch(streamUrl, { headers: fetchHeaders, redirect: "follow" }); }
  catch (error) { console.error("[Stream Segment] Fetch error:", error); return NextResponse.json({ error: "Failed to fetch segment" }, { status: 502 }); }

  // Build response headers
  const responseHeaders = new Headers();
  if (streamUrl.includes(".vtt")) responseHeaders.set("Content-Type", "text/vtt; charset=utf-8");
  else if (streamUrl.includes(".m3u8")) responseHeaders.set("Content-Type", "application/vnd.apple.mpegurl");
  else if (streamUrl.includes(".mp4") || streamUrl.includes(".ts")) responseHeaders.set("Content-Type", "video/mp2t");
  else { const ct = upstreamResponse.headers.get("content-type"); responseHeaders.set("Content-Type", ct || "application/octet-stream"); }

  const cl = upstreamResponse.headers.get("content-length"); if (cl) responseHeaders.set("Content-Length", cl);
  const cr = upstreamResponse.headers.get("content-range"); if (cr) responseHeaders.set("Content-Range", cr);
  responseHeaders.set("Accept-Ranges", "bytes");
  responseHeaders.set("Access-Control-Allow-Origin", "*");
  responseHeaders.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  responseHeaders.set("Access-Control-Allow-Headers", "Range, Content-Type");
  responseHeaders.set("Access-Control-Expose-Headers", "Content-Range, Content-Length");
  responseHeaders.set("Cache-Control", "public, max-age=86400");

  // For M3U8 responses, read text and pass through
  if (streamUrl.includes(".m3u8")) {
    const text = await upstreamResponse.text();
    return new NextResponse(text, { status: 200, headers: responseHeaders });
  }

  return new NextResponse(upstreamResponse.body, { status: upstreamResponse.status, headers: responseHeaders });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: {
    "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Range, Content-Type", "Access-Control-Max-Age": "86400",
  }});
}
