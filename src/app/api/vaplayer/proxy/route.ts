import { NextRequest, NextResponse } from "next/server";

// ❌ JANGAN pakai "edge" runtime

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

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
    const targetUrl = searchParams.get("u");

    if (!targetUrl) {
      return NextResponse.json({ error: "Parameter 'u' wajib diisi" }, { status: 400 });
    }

    // Validasi URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(targetUrl);
    } catch {
      return NextResponse.json({ error: "URL tidak valid", received: targetUrl.slice(0, 100) }, { status: 400 });
    }

    // Cek domain whitelist
    const isAllowed = ALLOWED_DOMAINS.some(d => parsedUrl.hostname.includes(d));
    if (!isAllowed) {
      return NextResponse.json(
        { error: `Domain tidak diizinkan: ${parsedUrl.hostname}` },
        { status: 403 }
      );
    }

    console.log("[Vaplayer Proxy] Fetching:", parsedUrl.pathname.slice(0, 80));

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
      console.error("[Vaplayer Proxy] Upstream error:", resp.status);
      return NextResponse.json(
        { error: `Upstream ${resp.status}` },
        { status: resp.status }
      );
    }

    const contentType = resp.headers.get("content-type") || "application/octet-stream";
    const body = await resp.arrayBuffer();

    // Rewrite URLs di m3u8 content
    let finalBody: ArrayBuffer | string = body;
    const isM3u8 = contentType.includes("mpegurl") || 
                   contentType.includes("text/plain") || 
                   targetUrl.includes(".m3u8");

    if (isM3u8) {
      let text = new TextDecoder().decode(body);

      // Rewrite URL absolut (https://...) ke proxy
      ALLOWED_DOMAINS.forEach(domain => {
        const regex = new RegExp(`https?://[^/]*${domain.replace(/\./g, "\\.")}[^\\s"']*`, "g");
        text = text.replace(regex, (match) => {
          return `/api/vaplayer/proxy?u=${encodeURIComponent(match)}`;
        });
      });

      // Rewrite URL relatif (mulai dengan /)
      const origin = parsedUrl.origin;
      const lines = text.split(/\r?\n/);
      const rewritten = lines.map(line => {
        // Skip empty, comment, atau sudah proxy
        if (!line || line.startsWith("#") || line.startsWith("/api/")) return line;
        // Skip full URL yang bukan vaplayer domain
        if (line.startsWith("http") && !ALLOWED_DOMAINS.some(d => line.includes(d))) {
          return line;
        }
        // Rewrite relative URL
        if (line.startsWith("/")) {
          const fullUrl = `${origin}${line}`;
          return `/api/vaplayer/proxy?u=${encodeURIComponent(fullUrl)}`;
        }
        return line;
      });
      text = rewritten.join("\n");
      finalBody = text;

      console.log("[Vaplayer Proxy] Rewritten m3u8, size:", text.length);
    }

    return new NextResponse(finalBody as any, {
      status: 200,
      headers: {
        "Content-Type": isM3u8 ? "application/vnd.apple.mpegurl" : contentType,
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
        "Access-Control-Allow-Headers": "*",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });

  } catch (err: any) {
    console.error("[Vaplayer Proxy] FATAL:", err);
    return NextResponse.json(
      { error: "Proxy crash", message: err?.message || String(err) },
      { status: 500 }
    );
  }
}

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
