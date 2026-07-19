import { NextRequest, NextResponse } from "next/server";

// ❌ JANGAN pakai "edge" runtime
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    let targetUrl = searchParams.get("u");
    if (!targetUrl) return NextResponse.json({ error: "Parameter 'u' wajib diisi" }, { status: 400 });
    try { targetUrl = decodeURIComponent(targetUrl); } catch {}

    let parsedUrl: URL;
    try { parsedUrl = new URL(targetUrl); }
    catch { return NextResponse.json({ error: "URL tidak valid" }, { status: 400 }); }

    if (parsedUrl.protocol !== "https:") {
      return NextResponse.json({ error: "Hanya HTTPS" }, { status: 403 });
    }

    // Fetch TANPA Origin/Referer (bypass anti-Cloudflare check)
    const upstreamResp = await fetch(targetUrl, {
      headers: {
        "User-Agent": UA,
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (!upstreamResp.ok) {
      return NextResponse.json(
        { error: `Upstream ${upstreamResp.status}` },
        { status: upstreamResp.status }
      );
    }

    const contentType = upstreamResp.headers.get("content-type") || "application/octet-stream";
    const isM3u8 = contentType.includes("mpegurl") || targetUrl.includes(".m3u8");

    if (isM3u8) {
      const text = await upstreamResp.text();
      // Rewrite URL relatif menjadi absolut (TANPA proxy)
      const origin = parsedUrl.origin;
      const lines = text.split(/\r?\n/);
      const result = lines.map(line => {
        if (!line || line.startsWith("#")) return line;
        if (line.startsWith("http")) return line;
        if (line.startsWith("/")) return origin + line;
        return line;
      }).join("\n");
      return new NextResponse(result, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=5",
        },
      });
    }

    // Segment: stream langsung
    return new NextResponse(upstreamResp.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Expose-Headers": "Content-Length, Content-Range",
        "Cache-Control": "public, max-age=31536000, immutable",
        "Accept-Ranges": "bytes",
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: "Proxy crash", message: err?.message }, { status: 500 });
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
