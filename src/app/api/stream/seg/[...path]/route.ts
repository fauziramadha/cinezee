import { NextRequest, NextResponse } from "next/server";

const VPS_BASE = "https://api.cinestream.biz.id";
const INTERNAL_AUTH_SECRET = "cs1-internal-cfworker-bypass-7f3a9b2e8c1d";
const DEFAULT_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const segPath = path.join("/");
  const search = request.nextUrl.search;
  const targetUrl = `${VPS_BASE}/api/stream/seg/${segPath}${search}`;

  const fetchHeaders: Record<string, string> = {
    "User-Agent": DEFAULT_UA,
    "Accept": "*/*",
    "X-Internal-Auth": INTERNAL_AUTH_SECRET,
  };

  const rangeHeader = request.headers.get("range");
  if (rangeHeader) fetchHeaders["Range"] = rangeHeader;

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(targetUrl, { headers: fetchHeaders, redirect: "follow" });
  } catch (error) {
    console.error("[Stream Seg] Fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch segment" }, { status: 502 });
  }

  const responseHeaders = new Headers();
  const ct = upstreamResponse.headers.get("content-type");
  if (ct) responseHeaders.set("Content-Type", ct);
  else responseHeaders.set("Content-Type", "video/mp2t");

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
