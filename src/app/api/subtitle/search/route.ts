import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export const dynamic = "force-dynamic";

async function getEnvVar(key: string): Promise<string> {
  try {
    const ctx = await getCloudflareContext();
    return ((ctx?.env?.[key] as string) || "").trim();
  } catch {
    return (process.env[key] || "").trim();
  }
}

async function getImdbId(tmdbId: string, type: string): Promise<string | null> {
  const apiKey = await getEnvVar("TMDB_API_KEY") || await getEnvVar("NEXT_PUBLIC_TMDB_API_KEY");
  if (!apiKey) return null;
  try {
    const url = `https://api.themoviedb.org/3/${type}/${tmdbId}/external_ids?api_key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.imdb_id || null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tmdbId = searchParams.get("tmdb_id");
    const type = searchParams.get("type") || "movie";
    const season = searchParams.get("season");
    const episode = searchParams.get("episode");

    if (!tmdbId) return NextResponse.json({ error: "Missing tmdb_id" }, { status: 400 });

    const imdbId = await getImdbId(tmdbId, type);
    const results: any[] = [];

    // === 1. OpenSubtitles ===
    const osKey = await getEnvVar("OPENSUBTITLES_API_KEY");
    if (osKey) {
      try {
        let osUrl = `https://api.opensubtitles.com/api/v1/subtitles?languages=id`;
        if (imdbId) osUrl += `&imdb_id=${imdbId.replace("tt", "")}`;
        else osUrl += `&tmdb_id=${tmdbId}`;
        if (type === "tv" && season && episode) osUrl += `&season_number=${season}&episode_number=${episode}`;

        const osRes = await fetch(osUrl, {
          headers: { "Api-Key": osKey, "User-Agent": "CineStream v1.0" },
        });

        if (osRes.ok) {
          const osData = await osRes.json();
          const subs = osData?.data || [];
          for (const sub of subs.slice(0, 5)) {
            const fileId = sub?.attributes?.files?.[0]?.file_id;
            const release = sub?.attributes?.release || "OpenSubtitles";
            if (fileId) {
              results.push({
                source: "opensubtitles",
                id: fileId,
                release: release,
                download_url: `/api/subtitle/download?source=os&id=${fileId}`
              });
            }
          }
        }
      } catch (e) {}
    }

    // === 2. SubSource ===
    const ssKey = await getEnvVar("SUBSOURCE_API_KEY");
    if (ssKey && imdbId) {
      try {
        // Search Movie
        const ssSearchUrl = `https://api.subsource.net/api/v1/movies/search?searchType=imdb&imdb=${imdbId}`;
        const ssSearchRes = await fetch(ssSearchUrl, { headers: { "X-API-Key": ssKey } });
        
        if (ssSearchRes.ok) {
          const ssSearchData = await ssSearchRes.json();
          const movies = ssSearchData?.results || ssSearchData?.data || [];
          if (movies.length > 0) {
            const movieId = movies[0]?.id || movies[0]?._id;
            if (movieId) {
              // Get Subtitles
              const ssSubUrl = `https://api.subsource.net/api/v1/subtitles?movieId=${movieId}`;
              const ssSubRes = await fetch(ssSubUrl, { headers: { "X-API-Key": ssKey } });
              
              if (ssSubRes.ok) {
                const ssSubData = await ssSubRes.json();
                const subs = ssSubData?.subtitles || ssSubData?.data || [];
                for (const sub of subs) {
                  const langStr = JSON.stringify(sub).toLowerCase();
                  if (langStr.includes("indonesian") || langStr.includes("bahasa") || langStr.includes('"id"')) {
                    const subId = sub?.id || sub?._id;
                    const release = sub?.release || sub?.filename || "SubSource";
                    if (subId) {
                      results.push({
                        source: "subsource",
                        id: subId,
                        release: release,
                        download_url: `/api/subtitle/download?source=ss&id=${subId}`
                      });
                    }
                  }
                }
              }
            }
          }
        }
      } catch (e) {}
    }

    return NextResponse.json({
      success: true,
      subtitles: results
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, message: error?.message }, { status: 500 });
  }
}
