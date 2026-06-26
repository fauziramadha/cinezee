/**
 * src/middleware.ts
 *
 * Middleware keamanan untuk CineStream:
 * - Security headers (XSS, clickjacking, MIME sniffing protection)
 * - Bot scraper protection (block curl, wget, scrapy, dll)
 * - NextAuth route protection (skip middleware untuk auth routes)
 *
 * NOTE: Rate limiting akan di-setup via Cloudflare Dashboard (free 1 rule)
 * karena Workers edge tidak punya memory persistent antar request.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ============================================================
// SECURITY HEADERS
// ============================================================
const securityHeaders = [
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload", // HSTS 2 tahun
  },
  {
    key: "X-Frame-Options",
    value: "SAMEORIGIN", // Cegah clickjacking
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff", // Cegah MIME sniffing
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  {
    key: "X-XSS-Protection",
    value: "1; mode=block",
  },
];

// ============================================================
// BOT USER-AGENTS YANG DIBLOCK
// (Bot scraper tools, tapi TIDAK block Googlebot/Bingbot untuk SEO)
// ============================================================
const BLOCKED_BOTS = [
  "curl",
  "wget",
  "scrapy",
  "python-requests",
  "python-urllib",
  "httpclient",
  "okhttp",
  "java/",
  "go-http-client",
  "node-fetch",
  "axios",
  "postman",
  "insomnia",
  "httpie",
  "phantomjs",
  "headless",
  "selenium",
  "puppeteer",
  "cheerio",
  "mechanize",
  "httpunit",
  "nutch",
  "httrack",
  "webcrawler",
  "webcopy",
  "sitechecker",
  "ahrefsbot",      // SEO bot (optional, bisa di-uncomment kalau mau block)
  "semrushbot",     // SEO bot (optional)
  "dotbot",
  "mj12bot",
  "bytespider",
  "petalbot",
  "yandexbot",
];

// Search engine bots yang TIDAK boleh diblock (untuk SEO)
const ALLOWED_BOTS = [
  "googlebot",
  "bingbot",
  "slurp",          // Yahoo
  "duckduckbot",
  "baiduspider",
  "facebookexternalhit",
  "twitterbot",
  "linkedinbot",
  "telegrambot",
  "whatsapp",
  "discordbot",
  "skypeuripreview",
];

// ============================================================
// RATE LIMITING (In-Memory, sederhana)
// NOTE: Tidak akurat di Workers edge (tiap region punya memory sendiri)
// Untuk rate limiting akurat, pakai Cloudflare Dashboard Rate Limiting
// ============================================================
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 menit
const RATE_LIMIT_MAX = 100; // 100 request per menit per IP

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }

  record.count++;
  return record.count <= RATE_LIMIT_MAX;
}

// Cleanup old entries tiap 1000 request (mencegah memory leak)
let cleanupCounter = 0;
function cleanupRateLimit() {
  cleanupCounter++;
  if (cleanupCounter < 1000) return;
  cleanupCounter = 0;

  const now = Date.now();
  for (const [ip, record] of rateLimitMap.entries()) {
    if (now > record.resetTime) {
      rateLimitMap.delete(ip);
    }
  }
}

// ============================================================
// MAIN MIDDLEWARE
// ============================================================
export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const userAgent = request.headers.get("user-agent") || "";
  const ip = request.headers.get("cf-connecting-ip") ||
             request.headers.get("x-forwarded-for") ||
             "unknown";

  // === Skip middleware untuk NextAuth & static assets ===
  if (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next/static") ||
    pathname.startsWith("/_next/image") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.match(/\.(jpg|jpeg|png|gif|webp|svg|ico|css|js|woff|woff2|ttf|eot)$/)
  ) {
    return NextResponse.next();
  }

  // === 1. BOT PROTECTION ===
  const ua = userAgent.toLowerCase();

  // Cek apakah bot yang allowed (Google, Bing, dll)
  const isAllowedBot = ALLOWED_BOTS.some((bot) => ua.includes(bot));

  if (!isAllowedBot) {
    // Cek apakah bot yang diblock
    const isBlockedBot = BLOCKED_BOTS.some((bot) => ua.includes(bot));

    if (isBlockedBot) {
      return new NextResponse("Access Denied", {
        status: 403,
        headers: {
          "Content-Type": "text/plain",
          "X-Blocked-Reason": "bot-detected",
        },
      });
    }

    // Block User-Agent kosong (biasanya bot)
    if (!userAgent || userAgent.trim().length === 0) {
      return new NextResponse("Access Denied", {
        status: 403,
        headers: {
          "Content-Type": "text/plain",
          "X-Blocked-Reason": "missing-user-agent",
        },
      });
    }
  }

  // === 2. RATE LIMITING (hanya untuk API routes) ===
  if (pathname.startsWith("/api/")) {
    cleanupRateLimit();

    if (!checkRateLimit(ip)) {
      return new NextResponse(
        JSON.stringify({ error: "Too many requests. Please try again later." }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": "60",
            "X-RateLimit-Limit": String(RATE_LIMIT_MAX),
            "X-RateLimit-Window": "60",
          },
        }
      );
    }
  }

  // === 3. SECURITY HEADERS ===
  const response = NextResponse.next();

  // Tambah semua security headers
  securityHeaders.forEach((header) => {
    response.headers.set(header.key, header.value);
  });

  // === 4. CUSTOM HEADERS untuk monitoring ===
  response.headers.set("X-Powered-By", "CineStream"); // Sembunyikan Next.js asli
  response.headers.set("X-Request-Id", generateRequestId());

  return response;
}

// ============================================================
// HELPER: Generate request ID
// ============================================================
function generateRequestId(): string {
  return (
    Date.now().toString(36) +
    Math.random().toString(36).substring(2, 10)
  );
}

// ============================================================
// MATCHER — Konfigurasi route yang dijalankan middleware
// ============================================================
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico
     * - public assets
     */
    "/((?!_next/static|_next/image|favicon.ico|public/).*)",
  ],
};
