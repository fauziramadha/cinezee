import { NextRequest, NextResponse } from "next/server";

const ALLOWED_DOMAINS = ["s1.cccdn.net", "s2.cccdn.net", "s3.cccdn.net", "cinemacity.cc"];
const DEFAULT_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const streamUrl = url.searchParams.get("url");

  if (!streamUrl) {
    return NextResponse.json({ error: "Missing 'url' parameter" }, { status: 400 });
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(streamUrl);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  const isAllowed = ALLOWED_DOMAINS.some(
    (domain) => parsedUrl.hostname === domain || parsedUrl.hostname.endsWith(`.${domain}`)
  );

  if (!isAllowed) {
    return NextResponse.json({
      error: `Domain not allowed: ${parsedUrl.hostname}`,
      allowed: ALLOWED_DOMAINS,
    }, { status: 403 });
  }

  const fetchHeaders: Record<string, string> = {
    "User-Agent": DEFAULT_UA,
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://cinemacity.cc/",
    "Origin": "https://cinemacity.cc",
  };

  const rangeHeader = request.headers.get("range");
  if (rangeHeader) {
    fetchHeaders["Range"] = rangeHeader;
  }

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(streamUrl, { headers: fetchHeaders, redirect: "follow" });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch stream", detail: String(error) }, { status: 502 });
  }

  const responseHeaders = new Headers();

    // Content-Type — FORCE correct type berdasarkan extension
  // (s1.cccdn.net return "application/octet-stream" untuk VTT, browser nolak sebagai subtitle)
  if (streamUrl.includes(".vtt")) {
    responseHeaders.set("Content-Type", "text/vtt; charset=utf-8");
  } else if (streamUrl.includes(".m3u8")) {
    responseHeaders.set("Content-Type", "application/vnd.apple.mpegurl");
  } else if (streamUrl.includes(".mp4")) {
    responseHeaders.set("Content-Type", "video/mp4");
  } else {
    const upstreamCt = upstreamResponse.headers.get("content-type");
    responseHeaders.set("Content-Type", upstreamCt || "application/octet-stream");
  }

  const contentLength = upstreamResponse.headers.get("content-length");
  if (contentLength) responseHeaders.set("Content-Length", contentLength);

  const contentRange = upstreamResponse.headers.get("content-range");
  if (contentRange) responseHeaders.set("Content-Range", contentRange);

  responseHeaders.set("Accept-Ranges", "bytes");
  responseHeaders.set("Access-Control-Allow-Origin", "*");
  responseHeaders.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  responseHeaders.set("Access-Control-Allow-Headers", "Range, Content-Type");
  responseHeaders.set("Access-Control-Expose-Headers", "Content-Range, Content-Length");

  if (streamUrl.includes(".m3u8")) {
    responseHeaders.set("Cache-Control", "public, max-age=60");
  } else if (streamUrl.includes(".mp4") || streamUrl.includes(".vtt")) {
    responseHeaders.set("Cache-Control", "public, max-age=86400");
  }

  return new NextResponse(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers: responseHeaders,
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "Range, Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}
