import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// ============================================================
// HELPER: Get IMDb ID from TMDB ID
// ============================================================
async function getImdbId(tmdbId: string, type: string): Promise<string | null> {
  const apiKey = process.env.TMDB_API_KEY || process.env.NEXT_PUBLIC_TMDB_API_KEY;
  if (!apiKey) return null;

  try {
    const url = `https://api.themoviedb.org/3/${type}/${tmdbId}/external_ids?api_key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.imdb_id || null;
  } catch (err) {
    console.error("[TMDB] Get IMDB ID error:", err);
    return null;
  }
}

// ============================================================
// 1. OPENSUBTITLES
// ============================================================
async function searchOpenSubtitles(tmdbId: string, type: string, season: string, episode: string): Promise<{ url: string } | null> {
  const apiKey = process.env.OPENSUBTITLES_API_KEY;
  if (!apiKey) return null;

  try {
    let searchUrl = "https://api.opensubtitles.com/api/v1/subtitles?tmdb_id=" + tmdbId + "&languages=id";
    if (type === "tv" && season && episode) {
      searchUrl += "&season_number=" + season + "&episode_number=" + episode;
    }

    const searchRes = await fetch(searchUrl, {
      headers: {
        "Api-Key": apiKey,
        "User-Agent": "CineStream v1.0",
      },
    });

    if (!searchRes.ok) return null;

    const searchData = await searchRes.json();
    const subtitles = searchData?.data || [];
    if (subtitles.length === 0) return null;

    const fileId = subtitles[0]?.attributes?.files?.[0]?.file_id;
    if (!fileId) return null;

    const dlRes = await fetch("https://api.opensubtitles.com/api/v1/download", {
      method: "POST",
      headers: {
        "Api-Key": apiKey,
        "Content-Type": "application/json",
        "User-Agent": "CineStream v1.0",
      },
      body: JSON.stringify({ file_id: fileId }),
    });

    if (!dlRes.ok) return null;

    const dlData = await dlRes.json();
    if (dlData?.link) {
      return { url: dlData.link };
    }

    return null;
  } catch (err) {
    console.error("[OS] Error:", err);
    return null;
  }
}

// ============================================================
// 2. SUBDL
// ============================================================
async function searchSubDL(title: string, type: string): Promise<{ url: string } | null> {
  const apiKey = process.env.SUBDL_API_KEY;
  if (!apiKey) return null;

  try {
    // Step 1: Search movie by title
    const searchUrl = "https://api.subdl.com/api/v2/movies/search?q=" + encodeURIComponent(title) + "&type=" + (type === "tv" ? "tv" : "movie") + "&limit=5";
    
    const searchRes = await fetch(searchUrl, {
      headers: { "Authorization": "Bearer " + apiKey },
    });

    if (!searchRes.ok) return null;

    const searchData = await searchRes.json();
    const movies = searchData?.results || searchData?.data || searchData?.movies || [];
    if (movies.length === 0) return null;

    const movie = movies[0];
    const movieId = movie?.sd_id || movie?.id || movie?.subdl_id;
    if (!movieId) return null;

    // Step 2: Get subtitles for movie
    const subUrl = "https://api.subdl.com/api/v2/subtitles?film_id=" + movieId + "&language=id";
    const subRes = await fetch(subUrl, {
      headers: { "Authorization": "Bearer " + apiKey },
    });

    if (!subRes.ok) return null;

    const subData = await subRes.json();
    const subtitles = subData?.subtitles || subData?.data || [];
    if (subtitles.length === 0) return null;

    const sub = subtitles.find((s: any) => 
      s?.language?.toLowerCase().includes("id") || 
      s?.lang?.toLowerCase().includes("id") ||
      s?.language?.toLowerCase().includes("indonesian")
    ) || subtitles[0];

    const subtitleId = sub?.sd_id || sub?.id || sub?.subdl_id;
    if (!subtitleId) return null;

    // Step 3: Download subtitle
    const dlUrl = "https://api.subdl.com/api/v2/subtitles/" + subtitleId + "/download?format=file";
    const dlRes = await fetch(dlUrl, {
      headers: { "Authorization": "Bearer " + apiKey },
    });

    if (!dlRes.ok) return null;

    const contentType = dlRes.headers.get("content-type") || "";
    if (contentType.includes("json")) {
      const dlData = await dlRes.json();
      const link = dlData?.link || dlData?.url || dlData?.download_url;
      if (link) return { url: link };
    } else {
      const text = await dlRes.text();
      return { url: "data:text/srt;base64," + Buffer.from(text).toString("base64") };
    }

    return null;
  } catch (err) {
    console.error("[SubDL] Error:", err);
    return null;
  }
}

// ============================================================
// 3. SUBSOURCE (Menggunakan IMDb ID)
// ============================================================
async function searchSubSource(imdbId: string): Promise<{ url: string } | null> {
  const apiKey = process.env.SUBSOURCE_API_KEY;
  if (!apiKey) return null;

  try {
    // Step 1: Search movie by IMDb ID
    // Menggunakan q=imdbId agar pencarian akurat
    const searchUrl = "https://api.subsource.net/api/v1/movies/search?searchType=imdb&q=" + imdbId;
    
    const searchRes = await fetch(searchUrl, {
      headers: { "X-API-Key": apiKey },
    });

    if (!searchRes.ok) {
      console.error("[SubSource] Search failed:", searchRes.status);
      return null;
    }

    const searchData = await searchRes.json();
    const movies = searchData?.results || searchData?.data || searchData?.movies || [];
    if (movies.length === 0) return null;

    const movie = movies[0];
    const movieId = movie?.id || movie?.subsource_id;
    if (!movieId) return null;

    // Step 2: Get subtitles (filter Indonesian)
    const subUrl = "https://api.subsource.net/api/v1/subtitles?movieId=" + movieId + "&language=indonesian";
    const subRes = await fetch(subUrl, {
      headers: { "X-API-Key": apiKey },
    });

    if (!subRes.ok) return null;

    const subData = await subRes.json();
    const subtitles = subData?.subtitles || subData?.data || [];
    if (subtitles.length === 0) return null;

    const sub = subtitles[0];
    const subtitleId = sub?.id || sub?.subsource_id;
    if (!subtitleId) return null;

    // Step 3: Download subtitle (ZIP archive)
    const dlUrl = "https://api.subsource.net/api/v1/subtitles/" + subtitleId + "/download";
    const dlRes = await fetch(dlUrl, {
      headers: { "X-API-Key": apiKey },
    });

    if (!dlRes.ok) return null;

    const contentType = dlRes.headers.get("content-type") || "";
    if (contentType.includes("json")) {
      const dlData = await dlRes.json();
      const link = dlData?.link || dlData?.url || dlData?.download_url;
      if (link) return { url: link };
    } else if (contentType.includes("zip") || contentType.includes("octet-stream")) {
      return { url: dlUrl + "&api_key=" + apiKey };
    }

    return null;
  } catch (err) {
    console.error("[SubSource] Error:", err);
    return null;
  }
}

// ============================================================
// MAIN: Cascade search
// ============================================================
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

    console.log("[Subtitle] Searching for:", { tmdbId, type, title, season, episode });

    // === 1. OpenSubtitles ===
    console.log("[Subtitle] Trying OpenSubtitles...");
    const osResult = await searchOpenSubtitles(tmdbId, type, season || "", episode || "");
    if (osResult) {
      console.log("[Subtitle] Found on OpenSubtitles");
      return NextResponse.json({
        success: true,
        source: "opensubtitles",
        subtitle_url: osResult.url,
      });
    }

    // === 2. SubDL ===
    if (title) {
      console.log("[Subtitle] Trying SubDL...");
      const subdlResult = await searchSubDL(title, type);
      if (subdlResult) {
        console.log("[Subtitle] Found on SubDL");
        return NextResponse.json({
          success: true,
          source: "subdl",
          subtitle_url: subdlResult.url,
        });
      }
    }

    // === 3. SubSource ===
    console.log("[Subtitle] Trying SubSource...");
    // Dapatkan IMDb ID dari TMDB ID
    const imdbId = await getImdbId(tmdbId, type);
    if (imdbId) {
      console.log("[Subtitle] Got IMDb ID:", imdbId);
      const ssResult = await searchSubSource(imdbId);
      if (ssResult) {
        console.log("[Subtitle] Found on SubSource");
        return NextResponse.json({
          success: true,
          source: "subsource",
          subtitle_url: ssResult.url,
        });
      }
    } else {
      console.log("[Subtitle] Failed to get IMDb ID from TMDB");
    }

    // === Tidak ada subtitle ===
    console.log("[Subtitle] No subtitle found from any source");
    return NextResponse.json({
      success: false,
      message: "No Indonesian subtitle found from any source",
    }, { status: 404 });

  } catch (error: any) {
    console.error("[Subtitle Search] Error:", error);
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}
