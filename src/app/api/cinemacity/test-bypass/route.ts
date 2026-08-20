/**
 * src/app/api/cinemacity/test-bypass/route.ts
 *
 * Test: Cloudflare vs Cloudflare bypass
 * No cookies needed — pure headers + cf options
 */

import { NextRequest, NextResponse } from "next/server";

const CINEMACITY_BASE = "https://cinemacity.cc";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const path = url.searchParams.get("path") || "/";
  const targetUrl = `${CINEMACITY_BASE}${path}`;

  try {
    console.log(`[Test Bypass] Fetching: ${targetUrl}`);

    const response = await fetch(targetUrl, {
      method: "GET",
      headers: {
        // === TRIK 1: User-Agent Chrome Desktop Asli ===
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        "Sec-Ch-Ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": '"Windows"',
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
        // === TRIK 2: Referer wajib dari domain target ===
        "Referer": CINEMACITY_BASE + "/",
        "Origin": CINEMACITY_BASE,
      },
      // === TRIK 3: cf object untuk optimasi koneksi ===
      cf: {
        cacheEverything: false,
        cacheTtl: 0,
        // Polish & minify otomatis by Cloudflare
        polish: "off",
        minify: { javascript: false, css: false, html: false },
      },
      redirect: "follow",
    });

    const html = await response.text();
    const status = response.status;

    console.log(`[Test Bypass] Status: ${status}, Size: ${html.length}`);

    // Cek apakah dapat challenge page atau real content
    const isCloudflareChallenge = html.includes("Just a moment") || html.includes("challenge-platform");
    const hasMovies = html.includes("dar-short_item") || html.includes("/movies/");
    const hasTitle = html.includes("<title>CinemaCity");

    const result = {
      status,
      size: html.length,
      isCloudflareChallenge,
      hasMovies,
      hasTitle,
      title: html.match(/<title>([^<]*)<\/title>/)?.[1] || "No title",
      snippet: html.substring(0, 500),
      bypassed: !isCloudflareChallenge && status === 200,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("[Test Bypass Error]", error);
    return NextResponse.json({
      error: "Fetch failed",
      detail: String(error),
    }, { status: 500 });
  }
}
