/**
 * src/app/api/cinemacity/image/route.ts
 * Image proxy untuk cinemacity posters (bypass Cloudflare hotlink block)
 */

import { NextRequest, NextResponse } from "next/server";
import { dbCinemacity } from "@/lib/db-extended";

const ALLOWED_DOMAINS = ["cinemacity.cc"];
const DEFAULT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function cookiesToHeader(cookies: any[]): string {
  return cookies.map((c: any) => `${c.name}=${c.value}`).join("; ");
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const imageUrl = url.searchParams.get("url");

  if (!imageUrl) {
    return NextResponse.json({ error: "Missing 'url' parameter" }, { status: 400 });
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(imageUrl);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  const isAllowed = ALLOWED_DOMAINS.some(
    (d) => parsedUrl.hostname === d || parsedUrl.hostname.endsWith(`.${d}`)
  );
  if (!isAllowed) {
    return NextResponse.json(
      { error: `Domain not allowed: ${parsedUrl.hostname}` },
      { status: 403 }
    );
  }

  const cookieAccount = await dbCinemacity.getActiveCookies();
  if (!cookieAccount) {
    return NextResponse.json(
      { error: "No active cinemacity cookie account" },
      { status: 503 }
    );
  }

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(imageUrl, {
      headers: {
        "User-Agent": DEFAULT_UA,
        "Accept": "image/webp,image/apng,image/*,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://cinemacity.cc/",
        "Cookie": cookiesToHeader(cookieAccount.cookies),
      },
      redirect: "follow",
    });
  } catch (error) {
    console.error("[CINEMACITY IMAGE PROXY ERROR]", error);
    return NextResponse.json({ error: "Failed to fetch image" }, { status: 502 });
  }

  await dbCinemacity.touchLastUsed(cookieAccount.id);

  if (!upstreamResponse.ok) {
    return NextResponse.json(
      { error: `Upstream returned ${upstreamResponse.status}` },
      { status: upstreamResponse.status }
    );
  }

  const imageBuffer = await upstreamResponse.arrayBuffer();
  const contentType = upstreamResponse.headers.get("content-type") || "image/jpeg";

  const responseHeaders = new Headers();
  responseHeaders.set("Content-Type", contentType);
  responseHeaders.set("Cache-Control", "public, max-age=86400, s-maxage=604800");
  responseHeaders.set("Access-Control-Allow-Origin", "*");
  responseHeaders.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  responseHeaders.set("X-Proxy-Source", "cinemacity.cc");

  return new NextResponse(imageBuffer, {
    status: 200,
    headers: responseHeaders,
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Max-Age": "86400",
    },
  });
}
