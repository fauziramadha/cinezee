import { NextRequest, NextResponse } from "next/server";

// ❌ JANGAN pakai "edge" runtime - tidak kompatibel dengan OpenNext Cloudflare
// (env vars tidak kebaca, fetch error, dll)

const UPSTREAM = "https://streamdata.vaplayer.ru/api.php";
const REFERER  = "https://nextgencloudfabric.com/";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const imdb   = searchParams.get("imdb");
    const type   = searchParams.get("type") || "movie";
    const season = searchParams.get("season");
    const episode = searchParams.get("episode");

    console.log("[Vaplayer] Request:", { imdb, type, season, episode });

    // === Validate ===
    if (!imdb) {
      return NextResponse.json(
        { error: 'Parameter "imdb" wajib diisi. Contoh: ?imdb=tt1375666' },
        { status: 400 }
      );
    }

    if (!imdb.match(/^tt\d{6,}$/i)) {
      return NextResponse.json(
        { 
          error: 'Format imdb tidak valid. Contoh valid: tt1375666',
          received: imdb,
        },
        { status: 400 }
      );
    }

    if (type !== "movie" && type !== "tv") {
      return NextResponse.json(
        { error: 'Parameter "type" harus "movie" atau "tv"' },
        { status: 400 }
      );
    }

    if (type === "tv" && (!season || !episode)) {
      return NextResponse.json(
        { error: 'Untuk type=tv, parameter "season" dan "episode" wajib diisi' },
        { status: 400 }
      );
    }

    // === Build upstream URL ===
    const params = new URLSearchParams({
      imdb: imdb,
      type: type,
    });
    if (type === "tv") {
      params.set("season",  String(season));
      params.set("episode", String(episode));
    }
    const upstreamUrl = `${UPSTREAM}?${params.toString()}`;
    console.log("[Vaplayer] Fetching upstream:", upstreamUrl);

    // === Fetch from vaplayer.ru ===
    const upstreamResp = await fetch(upstreamUrl, {
      method: "GET",
      headers: {
        "User-Agent":      UA,
        "Referer":         REFERER,
        "Origin":          "https://nextgencloudfabric.com",
        "Accept":          "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "X-Requested-With":"XMLHttpRequest",
      },
    });

    console.log("[Vaplayer] Upstream status:", upstreamResp.status);

    if (!upstreamResp.ok) {
      const errText = await upstreamResp.text().catch(() => "");
      console.error("[Vaplayer] Upstream error:", upstreamResp.status, errText.slice(0, 300));
      return NextResponse.json(
        {
          error: `Upstream error: ${upstreamResp.status}`,
          upstream_status: upstreamResp.status,
          body: errText.slice(0, 300),
        },
        { status: 502 }
      );
    }

    const ct = upstreamResp.headers.get("content-type") || "";
    if (!ct.includes("json")) {
      const text = await upstreamResp.text();
      console.error("[Vaplayer] Not JSON. CT:", ct, "Body:", text.slice(0, 300));
      return NextResponse.json(
        {
          error: "Upstream tidak return JSON",
          content_type: ct,
          body_preview: text.slice(0, 300),
        },
        { status: 502 }
      );
    }

    const data = await upstreamResp.json();
    console.log("[Vaplayer] Response status_code:", data?.status_code, "stream_urls count:", data?.data?.stream_urls?.length);

    // === Validate response shape ===
    if (data?.status_code !== "200" || !data?.data?.stream_urls?.length) {
      console.error("[Vaplayer] No stream_urls in response");
      return NextResponse.json(
        {
          error: "Film tidak ditemukan di vaplayer.ru",
          upstream_response: data,
        },
        { status: 404 }
      );
    }

    // === Return ke client ===
    return NextResponse.json(data, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        "Access-Control-Allow-Origin": "*",
      },
    });

  } catch (err: any) {
    console.error("[Vaplayer] FATAL crash:", err);
    return NextResponse.json(
      {
        error: "Internal error",
        message: err?.message || String(err),
        stack: err?.stack?.split("\n").slice(0, 5),
      },
      { status: 500 }
    );
  }
}
