import { NextRequest, NextResponse } from "next/server";

// ❌ JANGAN pakai "edge" runtime

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

// Daftar domain vaplayer yang butuh Referer bypass
const ALLOWED_DOMAINS = [
  "onlinevisibilitysystem.site",
  "quietmidnightgardeningideas.site",
  "app.putgate.com",
  "vidapi.cloud",
  "nextgencloudfabric.com",
  "streamdata.vaplayer.ru",
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const encodedUrl = searchParams.get("u");

    if (!encodedUrl) {
      return NextResponse.json({ error: "Parameter 'u' wajib diisi" }, { status: 400 });
    }

    // Decode URL (bisa base64 atau URL-encoded)
    let targetUrl: string;
    try {
      // Coba base64 decode dulu
      targetUrl = Buffer.from(encodedUrl, "base64").toString("utf-8");
      if (!targetUrl.startsWith("http")) {
        // Bukan base64, coba URL decode
        targetUrl = decodeURIComponent(encodedUrl);
      }
    } catch {
      targetUrl = decodeURIComponent(encodedUrl);
    }

    // Validasi URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(targetUrl);
    } catch {
      return NextResponse.json({ error: "URL tidak valid" }, { status: 400 });
    }

    // Cek domain whitelist
    const isAllowed = ALLOWED_DOMAINS.some(d => parsedUrl.hostname.includes(d));
    if (!isAllowed) {
      return NextResponse.json(
        { error: `Domain tidak diizinkan: ${parsedUrl.hostname}` },
        { status: 403 }
      );
    }

    console.log("[Vaplayer Proxy] Fetching:", parsedUrl.pathname.slice(0, 80) + "...");

    // Fetch dengan Referer bypass
    const resp = await fetch(targetUrl, {
      headers: {
        "User-Agent": UA,
        "Referer": "https://nextgencloudfabric.com/",
        "Origin": "https://nextgencloudfabric.com",
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      console.error("[Vaplayer Proxy] Upstream error:", resp.status, errText.slice(0, 200));
      return NextResponse.json(
        { error: `Upstream ${resp.status}`, body: errText.slice(0, 200) },
        { status: resp.status }
      );
    }

    const contentType = resp.headers.get("content-type") || "application/octet-stream";
    const body = await resp.arrayBuffer();

    // Rewrite URLs di m3u8 content supaya pakai proxy juga
    let finalBody: ArrayBuffer | string = body;
    if (contentType.includes("mpegurl") || contentType.includes("text/plain") || targetUrl.includes(".m3u8")) {
      let text = new TextDecoder().decode(body);

      // Rewrite URL absolut (https://...) ke proxy
      ALLOWED_DOMAINS.forEach(domain => {
        const regex = new RegExp(`https?://[^/]*${domain.replace(/\./g, "\\.")}[^\\s"']*`, "g");
        text = text.replace(regex, (match) => {
          const encoded = Buffer.from(match).toString("base64");
          return `/api/vaplayer/proxy?u=${encoded}`;
        });
      });

      // Rewrite URL relatif (mulai dengan /) ke proxy
      // Cari base path dari URL asli
      const baseUrl = `${parsedUrl.origin}`;
      text = text.replace(/^\/([^\/\s].*)$/gm, (match, path) => {
        // Skip kalau sudah proxy URL atau comment
        if (match.startsWith("#") || match.startsWith("/api/")) return match;
        const fullUrl = `${baseUrl}${match}`;
        const encoded = Buffer.from(fullUrl).toString("base64");
        return `/api/vaplayer/proxy?u=${encoded}`;
      });

      finalBody = text;
    }

    return new NextResponse(finalBody as any, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
        "Access-Control-Allow-Headers": "*",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });

  } catch (err: any) {
    console.error("[Vaplayer Proxy] FATAL:", err);
    return NextResponse.json(
      {
        error: "Proxy crash",
        message: err?.message || String(err),
      },
      { status: 500 }
    );
  }
}

// Handle OPTIONS untuk CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}
