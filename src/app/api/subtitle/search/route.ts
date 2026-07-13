import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Kombinasi 3 API Subtitle: OpenSubtitles → SubDL → SubSource
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tmdbId = searchParams.get("tmdb_id");
    const type = searchParams.get("type") || "movie";
    const season = searchParams.get("season");
    const episode = searchParams.get("episode");
    const title = searchParams.get("title");

    if (!tmdbId) {
      return NextResponse.json({ error: "Missing tmdb_id" }, { status: 400 });
    }

    // === 1. OpenSubtitles ===
    const osApiKey = process.env.OPENSUBTITLES_API_KEY;
    if (osApiKey) {
      try {
        let osUrl = "https://api.opensubtitles.com/api/v1/subtitles?tmdb_id=" + tmdbId + "&languages=id&type=" + type;
        if (type === "tv" && season && episode) {
          osUrl += "&season_number=" + season + "&episode_number=" + episode;
        }

        const osRes = await fetch(osUrl, {
          headers: { "Api-Key": osApiKey, "User-Agent": "CineStream v1.0" },
        });

        if (osRes.ok) {
          const osData = await osRes.json();
          const subs = osData?.data || [];
          if (subs.length > 0) {
            const fileId = subs[0]?.attributes?.files?.[0]?.file_id;
            if (fileId) {
              const dlRes = await fetch("https://api.opensubtitles.com/api/v1/download", {
                method: "POST",
                headers: {
                  "Api-Key": osApiKey,
                  "Content-Type": "application/json",
                  "User-Agent": "CineStream v1.0",
                },
                body: JSON.stringify({ file_id: fileId }),
              });

              if (dlRes.ok) {
                const dlData = await dlRes.json();
                if (dlData?.link) {
                  return NextResponse.json({
                    success: true,
                    source: "opensubtitles",
                    subtitle_url: dlData.link,
                    raw_srt: true,
                  });
                }
              }
            }
          }
        }
      } catch (err) {
        console.error("[Subtitle] OpenSubtitles error:", err);
      }
    }

    // === 2. SubDL ===
    const subdlApiKey = process.env.SUBDL_API_KEY;
    if (subdlApiKey) {
      try {
        let subdlUrl = "https://api.subdl.com/api/v1/subtitles?api_key=" + subdlApiKey + "&tmdb_id=" + tmdbId + "&language=id";
        if (type === "tv" && season && episode) {
          subdlUrl += "&season=" + season + "&episode=" + episode;
        }

        const subdlRes = await fetch(subdlUrl);
        if (subdlRes.ok) {
          const subdlData = await subdlRes.json();
          const subs = subdlData?.subtitles || subdlData?.data || [];
          if (subs.length > 0) {
            const subUrl = subs[0]?.url || subs[0]?.link;
            if (subUrl) {
              const fullUrl = subUrl.startsWith("http") ? subUrl : "https://api.subdl.com" + subUrl;
              return NextResponse.json({
                success: true,
                source: "subdl",
                subtitle_url: fullUrl,
                raw_srt: true,
              });
            }
          }
        }
      } catch (err) {
        console.error("[Subtitle] SubDL error:", err);
      }
    }

    // === 3. SubSource ===
    const subsourceApiKey = process.env.SUBSOURCE_API_KEY;
    if (subsourceApiKey) {
      try {
        const ssRes = await fetch("https://api.subsource.net/api/search", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + subsourceApiKey,
          },
          body: JSON.stringify({
            query: title || "",
            tmdb_id: tmdbId,
            type: type,
            language: "id",
          }),
        });

        if (ssRes.ok) {
          const ssData = await ssRes.json();
          const subs = ssData?.subtitles || ssData?.data || [];
          if (subs.length > 0) {
            const subUrl = subs[0]?.url || subs[0]?.download_url;
            if (subUrl) {
              return NextResponse.json({
                success: true,
                source: "subsource",
                subtitle_url: subUrl,
                raw_srt: true,
              });
            }
          }
        }
      } catch (err) {
        console.error("[Subtitle] SubSource error:", err);
      }
    }

    // === Tidak ada subtitle ===
    return NextResponse.json({
      success: false,
      message: "No subtitle found from any source",
    }, { status: 404 });

  } catch (error: any) {
    console.error("[Subtitle Search] Error:", error);
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}
