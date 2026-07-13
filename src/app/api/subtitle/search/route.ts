import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export const dynamic = "force-dynamic";

// Helper untuk ambil env var dari Cloudflare Context
async function getEnvVar(key: string): Promise<string> {
  try {
    const ctx = await getCloudflareContext();
    const val = (ctx?.env?.[key] as string) || "";
    return val.trim();
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

// ============================================================
// 1. SUBDL
// ============================================================
async function searchSubDL(tmdbId: string, type: string, season: string, episode: string): Promise<{ url: string } | null> {
  const apiKey = await getEnvVar("SUBDL_API_KEY");
  if (!apiKey) {
    console.log("[SubDL] No API key");
    return null;
  }

  try {
    let searchUrl = `https://api.subdl.com/api/v2/subtitles/search?tmdb_id=${tmdbId}&type=${type === "tv" ? "tv" : "movie"}&languages=id&unpack=1`;
    if (type === "tv" && season && episode) {
      searchUrl += `&season=${season}&episode=${episode}`;
    }

    console.log("[SubDL] URL:", searchUrl);
    console.log("[SubDL] Key length:", apiKey.length);

    const res = await fetch(searchUrl, {
      headers: { 
        "Authorization": "Bearer " + apiKey,
        "Accept": "application/json"
      },
    });

    console.log("[SubDL] Status:", res.status);
    
    if (res.status === 403) {
      // Coba pakai X-API-Key header
      console.log("[SubDL] 403, trying X-API-Key...");
      const res2 = await fetch(searchUrl, {
        headers: { 
          "X-API-Key": apiKey,
          "Accept": "application/json"
        },
      });
      
      console.log("[SubDL] X-API-Key Status:", res2.status);
      if (!res2.ok) {
        console.log("[SubDL] Error:", await res2.text());
        return null;
      }
      
      const data2 = await res2.json();
      const subs2 = data2?.subtitles || data2?.data || [];
      console.log("[SubDL] Subtitles (X-API-Key):", subs2.length);
      
      if (subs2.length === 0) return null;
      
      const dlUrl = subs2[0]?.url || subs2[0]?.download_url || subs2[0]?.link;
      if (dlUrl) return { url: dlUrl };
      
      const subId = subs2[0]?.sd_id || subs2[0]?.id;
      if (subId) return { url: `https://api.subdl.com/api/v2/subtitles/${subId}/download` };
      
      return null;
    }

    if (!res.ok) {
      console.log("[SubDL] Error:", await res.text());
      return null;
    }

    const data = await res.json();
    console.log("[SubDL] Response keys:", Object.keys(data));
    
    const subtitles = data?.subtitles || data?.data || [];
    console.log("[SubDL] Subtitles found:", subtitles.length);
    
    if (subtitles.length === 0) return null;

    const sub = subtitles[0];
    const dlUrl = sub?.url || sub?.download_url || sub?.link;
    
    if (dlUrl) {
      console.log("[SubDL] Direct URL found");
      return { url: dlUrl };
    }

    const subId = sub?.sd_id || sub?.id;
    if (subId) {
      return { url: `https://api.subdl.com/api/v2/subtitles/${subId}/download` };
    }

    return null;
  } catch (err) {
    console.error("[SubDL] Error:", err);
    return null;
  }
}

// ============================================================
// 2. SUBSOURCE
// ============================================================
async function searchSubSource(imdbId: string): Promise<{ url: string } | null> {
  const apiKey = await getEnvVar("SUBSOURCE_API_KEY");
  if (!apiKey) {
    console.log("[SubSource] No API key");
    return null;
  }

  try {
    const searchUrl = `https://api.subsource.net/api/v1/movies/search?searchType=imdb&imdb=${imdbId}`;
    console.log("[SubSource] Search:", searchUrl);
    
    const searchRes = await fetch(searchUrl, {
      headers: { "X-API-Key": apiKey },
    });

    console.log("[SubSource] Search Status:", searchRes.status);
    if (!searchRes.ok) {
      console.log("[SubSource] Error:", await searchRes.text());
      return null;
    }

    const searchData = await searchRes.json();
    console.log("[SubSource] Search response:", JSON.stringify(searchData).substring(0, 500));
    
    const movies = searchData?.results || searchData?.data || searchData?.movies || [];
    console.log("[SubSource] Movies found:", movies.length);
    
    if (movies.length === 0) return null;

    const movie = movies[0];
    const movieId = movie?.id || movie?._id || movie?.movieId;
    console.log("[SubSource] Movie ID:", movieId);
    
    if (!movieId) return null;

    const subUrl = `https://api.subsource.net/api/v1/subtitles?movieId=${movieId}&language=indonesian`;
    console.log("[SubSource] Sub URL:", subUrl);
    
    const subRes = await fetch(subUrl, {
      headers: { "X-API-Key": apiKey },
    });

    console.log("[SubSource] Sub Status:", subRes.status);
    if (!subRes.ok) {
      console.log("[SubSource] Sub Error:", await subRes.text());
      return null;
    }

    const subData = await subRes.json();
    console.log("[SubSource] Sub response:", JSON.stringify(subData).substring(0, 500));
    
    const subtitles = subData?.subtitles || subData?.data || [];
    console.log("[SubSource] Subtitles found:", subtitles.length);
    
    if (subtitles.length === 0) return null;

    const sub = subtitles[0];
    const subtitleId = sub?.id || sub?._id;
    if (!subtitleId) return null;

    return { url: `https://api.subsource.net/api/v1/subtitles/${subtitleId}/download` };
  } catch (err) {
    console.error("[SubSource] Error:", err);
    return null;
  }
}

// ============================================================
// 3. OPENSUBTITLES
// ============================================================
async function searchOpenSubtitles(tmdbId: string, imdbId: string, type: string, season: string, episode: string): Promise<{ url: string } | null> {
  const apiKey = await getEnvVar("OPENSUBTITLES_API_KEY");
  if (!apiKey) {
    console.log("[OS] No API key");
    return null;
  }

  try {
    let searchUrl = `https://api.opensubtitles.com/api/v1/subtitles?languages=id&tmdb_id=${tmdbId}`;
    if (type === "tv" && season && episode) {
      searchUrl += `&season_number=${season}&episode_number=${episode}`;
    }

    console.log("[OS] Search:", searchUrl);
    let searchRes = await fetch(searchUrl, {
      headers: { "Api-Key": apiKey, "User-Agent": "CineStream v1.0" },
    });

    let subtitles = (await searchRes.json())?.data || [];

    if (subtitles.length === 0 && imdbId) {
      searchUrl = `https://api.opensubtitles.com/api/v1/subtitles?languages=id&imdb_id=${imdbId.replace("tt", "")}`;
      if (type === "tv" && season && episode) {
        searchUrl += `&season_number=${season}&episode_number=${episode}`;
      }
      searchRes = await fetch(searchUrl, {
        headers: { "Api-Key": apiKey, "User-Agent": "CineStream v1.0" },
      });
      subtitles = (await searchRes.json())?.data || [];
    }

    console.log("[OS] Found:", subtitles.length);
    if (subtitles.length === 0) return null;

    for (const sub of subtitles.slice(0, 3)) {
      const fileId = sub?.attributes?.files?.[0]?.file_id;
      if (!fileId) continue;

      console.log("[OS] Trying file_id:", fileId);
      await new Promise(r => setTimeout(r, 1500));

      const dlRes = await fetch("https://api.opensubtitles.com/api/v1/download", {
        method: "POST",
        headers: {
          "Api-Key": apiKey,
          "Content-Type": "application/json",
          "User-Agent": "CineStream v1.0",
        },
        body: JSON.stringify({ file_id: fileId }),
      });

      console.log("[OS] Download status:", dlRes.status);
      if (dlRes.status === 503 || dlRes.status === 429) continue;
      if (!dlRes.ok) continue;

      const dlData = await dlRes.json();
      if (dlData?.link) {
        console.log("[OS] Got link!");
        return { url: dlData.link };
      }
    }

    return null;
  } catch (err) {
    console.error("[OS] Error:", err);
    return null;
  }
}

// ============================================================
// MAIN
// ============================================================
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tmdbId = searchParams.get("tmdb_id");
    const type = searchParams.get("type") || "movie";
    const season = searchParams.get("season");
    const episode = searchParams.get("episode");

    if (!tmdbId) return NextResponse.json({ error: "Missing tmdb_id" }, { status: 400 });

    console.log("===== SUBTITLE SEARCH =====");
    console.log("TMDB:", tmdbId, "Type:", type);

    // Cek API keys
    const subdlKey = await getEnvVar("SUBDL_API_KEY");
    const subsourceKey = await getEnvVar("SUBSOURCE_API_KEY");
    const osKey = await getEnvVar("OPENSUBTITLES_API_KEY");
    console.log("Keys - SubDL:", subdlKey ? `YES (${subdlKey.length} chars)` : "NO", 
                "SubSource:", subsourceKey ? `YES (${subsourceKey.length} chars)` : "NO",
                "OS:", osKey ? `YES (${osKey.length} chars)` : "NO");

    const imdbId = await getImdbId(tmdbId, type);
    console.log("IMDb:", imdbId);

    // 1. SubDL
    console.log("[1/3] SubDL...");
    const subdlResult = await searchSubDL(tmdbId, type, season || "", episode || "");
    if (subdlResult) {
      console.log("✓ Found on SubDL");
      return NextResponse.json({ success: true, source: "subdl", subtitle_url: subdlResult.url });
    }

    // 2. SubSource
    if (imdbId) {
      console.log("[2/3] SubSource...");
      const ssResult = await searchSubSource(imdbId);
      if (ssResult) {
        console.log("✓ Found on SubSource");
        return NextResponse.json({ success: true, source: "subsource", subtitle_url: ssResult.url });
      }
    }

    // 3. OpenSubtitles
    console.log("[3/3] OpenSubtitles...");
    const osResult = await searchOpenSubtitles(tmdbId, imdbId || "", type, season || "", episode || "");
    if (osResult) {
      console.log("✓ Found on OpenSubtitles");
      return NextResponse.json({ success: true, source: "opensubtitles", subtitle_url: osResult.url });
    }

    console.log("✗ No subtitle found");
    return NextResponse.json({ success: false, message: "No subtitle found" }, { status: 404 });

  } catch (error: any) {
    console.error("[Subtitle] Error:", error);
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}
