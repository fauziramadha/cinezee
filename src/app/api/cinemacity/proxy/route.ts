import { NextRequest, NextResponse } from "next/server";
import { dbCinemacity } from "@/lib/db-extended";

const CINEMACITY_BASE = "https://cinemacity.cc";
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function hashKey(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function cookiesToHeader(cookies: any[]): string {
  return cookies.map((c: any) => `${c.name}=${c.value}`).join("; ");
}

async function handleProxy(request: NextRequest): Promise<NextResponse> {
  let endpoint: string;
  let method: string;
  let body: any = null;
  let ttl: number = 300;

  if (request.method === "GET") {
    const url = new URL(request.url);
    endpoint = url.searchParams.get("endpoint") || "/";
    method = (url.searchParams.get("method") || "GET").toUpperCase();
    const ttlParam = url.searchParams.get("ttl");
    if (ttlParam) ttl = Number(ttlParam) || 300;
  } else if (request.method === "POST") {
    body = await request.json();
    endpoint = body.endpoint || "/";
    method = (body.method || "GET").toUpperCase();
    ttl = body.ttl || 300;
  } else {
    return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
  }

  if (
    endpoint.startsWith("http://") ||
    endpoint.startsWith("https://") ||
    !endpoint.startsWith("/")
  ) {
    return NextResponse.json(
      { error: "Endpoint must be relative path starting with /" },
      { status: 400 }
    );
  }

  const cacheKey = await hashKey(`${method}:${endpoint}:${body ? JSON.stringify(body) : ""}`);
  const cached = await dbCinemacity.getCache(cacheKey);
  if (cached) {
    return new NextResponse(cached.body, {
      status: cached.status_code,
      headers: {
        "Content-Type": cached.content_type || "application/json",
        "X-Cache": "HIT",
        "X-Cache-Expires": cached.expires_at,
      },
    });
  }

  const cookieAccount = await dbCinemacity.getActiveCookies();
  if (!cookieAccount) {
    return NextResponse.json(
      { error: "No active cinemacity cookie account." },
      { status: 503 }
    );
  }

  const targetUrl = `${CINEMACITY_BASE}${endpoint}`;
  const cookieHeader = cookiesToHeader(cookieAccount.cookies);

  const headers: Record<string, string> = {
    "User-Agent": DEFAULT_USER_AGENT,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7",
    "Accept-Language": "en-US,en;q=0.9,id;q=0.8",
    "Cookie": cookieHeader,
    "Referer": CINEMACITY_BASE + "/",
  };

  const fetchOptions: RequestInit = { method, headers, redirect: "follow" };

  if (method !== "GET" && method !== "HEAD") {
    if (body?.body) {
      if (typeof body.body === "string") {
        fetchOptions.body = body.body;
      } else {
        fetchOptions.body = JSON.stringify(body.body);
        headers["Content-Type"] = "application/json";
      }
    } else if (body) {
      fetchOptions.body = JSON.stringify(body);
      headers["Content-Type"] = "application/json";
    }
  }

  let cinemacityResponse: Response;
  try {
    cinemacityResponse = await fetch(targetUrl, fetchOptions);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch from cinemacity.cc", detail: String(error) },
      { status: 502 }
    );
  }

  await dbCinemacity.touchLastUsed(cookieAccount.id);

  const responseBody = await cinemacityResponse.text();
  const contentType =
    cinemacityResponse.headers.get("content-type") || "application/octet-stream";

  if (cinemacityResponse.status >= 200 && cinemacityResponse.status < 400) {
    try {
      await dbCinemacity.setCache({
        cache_key: cacheKey,
        endpoint,
        method,
        status_code: cinemacityResponse.status,
        body: responseBody,
        content_type: contentType,
        ttl_seconds: ttl,
      });
    } catch (cacheError) {
      console.error("[CINEMACITY PROXY CACHE ERROR]", cacheError);
    }
  }

  const responseHeaders = new Headers();
  responseHeaders.set("Content-Type", contentType);
  responseHeaders.set("X-Cache", "MISS");
  responseHeaders.set("X-Cinemacity-Status", cinemacityResponse.status.toString());
  responseHeaders.set("X-Cookie-Account", cookieAccount.label);

  return new NextResponse(responseBody, {
    status: cinemacityResponse.status,
    headers: responseHeaders,
  });
}

export const GET = handleProxy;
export const POST = handleProxy;
