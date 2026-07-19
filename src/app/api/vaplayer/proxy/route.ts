import { NextRequest, NextResponse } from "next/server";

// ❌ JANGAN pakai "edge" runtime

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

// Known vaplayer domains (untuk pattern matching)
const KNOWN_VAPLAYER_DOMAINS = [
  "onlinevisibilitysystem.site",
  "quietmidnightgardeningideas.site",
  "app.putgate.com",
  "vidapi.cloud",
  "nextgencloudfabric.com",
  "streamdata.vaplayer.ru",
  "strategicgrowthpartners.site",
];

// Pattern URL vaplayer (path mengandung /pl/H4sIAAA = base64 gzip token)
function isVaplayerUrl(url: URL): boolean {
  // Cek domain known
  if (KNOWN_VAPLAYER_DOMAINS.some(d => url.hostname.includes(d))) return true;
  
  // Cek pattern path vaplayer: /<random>/<random>/pl/<base64token>/master.m3u8
  const pathPattern = /\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+\/pl\/H4sIAAA/;
  if (pathPattern.test(url.pathname)) return true;
  
  // Cek pattern segment vaplayer: /<random>/content/<hex>/<hex>/page-<n>.html
  const segmentPattern = /\/[a-zA-Z0-9_-]+\/content\/[a-f0-9]+\/[a-f0-9]+\/page-\d+\.html/;
  if (segmentPattern.test(url.pathname)) return true;
  
  // Cek pattern vaplayer CDN: /cdnstr/H4sIAAA
  if (url.pathname.includes("/cdnstr/H4sIAAA")) return true;
  
  // Cek pattern vidapi.cloud static
  if (url.hostname.includes("vidapi.cloud")) return true;
  
  return false;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    let targetUrl = searchParams.get("u");

    if (!targetUrl) {
      return NextResponse.json({ error: "Parameter 'u' wajib diisi" }, { status: 400 });
    }

    // Decode URL (kalau masih encoded)
    try {
      // Coba decode dulu, kalau masih ada %, decode lagi
      const decoded = decodeURIComponent(targetUrl);
      targetUrl = decoded;
    } catch {}

    // Validasi URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(targetUrl);
    } catch {
      return NextResponse.json({ 
        error: "URL tidak valid", 
        received: targetUrl.slice(0, 200),
      }, { status: 400 });
    }

    // Hanya allow HTTPS
    if (parsedUrl.protocol !== "https:") {
      return NextResponse.json(
        { error: "Hanya HTTPS yang diizinkan" },
        { status: 403 }
      );
    }

    // Cek apakah URL pattern vaplayer
    const isVaplayer = isVaplayerUrl(parsedUrl);
    if (!isVaplayer) {
      // Untuk safety, allow saja tapi log warning
      console.warn("[Vaplayer Proxy] Unknown domain, but allowing:", parsedUrl.hostname);
      // Atau bisa juga reject:
      // return NextResponse.json(
      //   { error: `Domain tidak diizinkan: ${parsedUrl.hostname}` },
      //   { status: 403 }
      // );
    }

    console.log("[Vaplayer Proxy] Fetching:", parsedUrl.hostname, parsedUrl.pathname.slice(0, 60));

    // === Coba fetch dengan beberapa Referer headers ===
    const referers = [
      "https://nextgencloudfabric.com/",
      "https://vaplayer.ru/",
      "https://vidapi.ru/",
    ];

    let resp: Response | null = null;
    let lastError: any = null;

    for (const referer of referers) {
      try {
        resp = await fetch(targetUrl, {
          headers: {
            "User-Agent": UA,
            "Referer": referer,
            "Origin": new URL(referer).origin,
            "Accept": "*/*",
            "Accept-Language": "en-US,en;q=0.9",
          },
        });

        if (resp.ok) {
          console.log("[Vaplayer Proxy] Success with Referer:", referer);
          break;
        }

        // Kalau 403/401, coba Referer lain
        if (resp.status === 403 || resp.status === 401) {
          console.log(`[Vaplayer Proxy] ${resp.status} with Referer ${referer}, trying next...`);
          continue;
        }

        // Kalau 404, langsung break (URL memang tidak ada)
        if (resp.status === 404) {
          console.log("[Vaplayer Proxy] 404 - URL might be expired");
          break;
        }

        // Untuk error lain, coba Referer berikutnya
        continue;
      } catch (e) {
        lastError = e;
        console.warn(`[Vaplayer Proxy] Fetch error with ${referer}:`, e);
        continue;
      }
    }

    if (!resp) {
      return NextResponse.json(
        { error: "Fetch failed", message: lastError?.message || "Unknown error" },
        { status: 500 }
      );
    }

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      console.error("[Vaplayer Proxy] Upstream error:", resp.status, errText.slice(0, 200));
      return NextResponse.json(
        {
          error: `Upstream ${resp.status}`,
          status: resp.status,
          body: errText.slice(0, 300),
          hint: resp.status === 404 
            ? "URL mungkin sudah expired. Coba fetch ulang dari /api/vaplayer/stream" 
            : undefined,
        },
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

      console.log("[Vaplayer Proxy] m3u8 content (first 300 chars):", text.slice(0, 300));

      // Rewrite SEMUA URL absolut (https://...) ke proxy
      // Pattern: https://apapun.com/...
      text = text.replace(/https?:\/\/[^\s"']+/g, (match) => {
        return `/api/vaplayer/proxy?u=${encodeURIComponent(match)}`;
      });

      // Rewrite URL relatif (mulai dengan /)
      const origin = parsedUrl.origin;
      const lines = text.split(/\r?\n/);
      const rewritten = lines.map(line => {
        if (!line || line.startsWith("#")) return line;
        if (line.startsWith("/api/")) return line;
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
