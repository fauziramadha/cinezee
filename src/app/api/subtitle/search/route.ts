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
    console.error("[TMDB] Error:", err);
    return null;
  }
}

// ============================================================
// 1. OPENSUBTITLES
// ============================================================
async function searchOpenSubtitles(tmdbId: string, imdbId: string, type: string, season: string, episode: string): Promise<{ url: string } | null> {
  const apiKey = process.env.OPENSUBTITLES_API_KEY;
  if (!apiKey) return null;

  try {
    // Coba pakai tmdb_id dulu, kalau tidak ada pakai imdb_id
    let searchUrl = "https://api.opensubtitles.com/api/v1/subtitles?languages=id&tmdb_id=" + tmdbId;
    if (type === "tv" && season && episode) {
      searchUrl += "&season_number=" + season + "&episode_number=" + episode;
    }

    console.log("[OS] Searching TMDB:", searchUrl);
    let searchRes = await fetch(searchUrl, {
      headers: {
        "Api-Key": apiKey,
        "User-Agent": "CineStream v1.0",
      },
    });

    let searchData = await searchRes.json();
    let subtitles = searchData?.data || [];
    console.log("[OS] Found by TMDB:", subtitles.length);

    // Kalau tidak ada, coba pakai imdb_id
    if (subtitles.length === 0 && imdbId) {
      searchUrl = "https://api.opensubtitles.com/api/v1/subtitles?languages=id&imdb_id=" + imdbId.replace("tt", "");
      if (type === "tv" && season && episode) {
        searchUrl += "&season_number=" + season + "&episode_number=" + episode;
      }
      
      console.log("[OS] Searching IMDB:", searchUrl);
      searchRes = await fetch(searchUrl, {
        headers: {
          "Api-Key": apiKey,
          "User-Agent": "CineStream v1.0",
        },
      });
      
      searchData = await searchRes.json();
      subtitles = searchData?.data || [];
      console.log("[OS] Found by IMDB:", subtitles.length);
    }

    if (subtitles.length === 0) return null;

    const fileId = subtitles[0]?.attributes?.files?.[0]?.file_id;
    console.log("[OS] File ID:", fileId);
    if (!fileId) return null;

    // Download
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
    if (!dlRes.ok) return null;

    const dlData = await dlRes.json();
    console.log("[OS] Download link:", dlData?.link ? "YES" : "NO");
    
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
    const searchUrl = "https://api.subdl.com/api/v2/movies/search?q=" + encodeURIComponent(title) + "&type=" + (type === "tv" ? "tv" : "movie") + "&limit=5";
    
    console.log("[SubDL] Searching:", searchUrl);
    const searchRes = await fetch(searchUrl, {
      headers: { "Authorization": "Bearer " + apiKey },
    });

    console.log("[SubDL] Search status:", searchRes.status);
    if (!searchRes.ok) {
      const errText = await searchRes.text();
      console.log("[SubDL] Error response:", errText);
      return null;
    }

    const searchData = await searchRes.json();
    const movies = searchData?.results || searchData?.data || searchData?.movies || [];
    console.log("[SubDL] Movies found:", movies.length);
    
    if (movies.length === 0) return null;

    const movie = movies[0];
    let subtitles = movie?.subtitles || [];
    
    if (subtitles.length === 0) {
      const movieId = movie?.sd_id || movie?.id || movie?.subdl_id;
      if (!movieId) return null;
      
      const subUrl = "https://api.subdl.com/api/v2/subtitles?film_id=" + movieId + "&language=id";
      const subRes = await fetch(subUrl, {
        headers: { "Authorization": "Bearer " + apiKey },
      });
      
      if (!subRes.ok) return null;
      
      const subData = await subRes.json();
      subtitles = subData?.subtitles || subData?.data || [];
    }
    
    if (subtitles.length === 0) return null;

    const sub = subtitles.find((s: any) => 
      s?.language?.toLowerCase().includes("id") || 
      s?.lang?.toLowerCase().includes("id") ||
      s?.language?.toLowerCase().includes("indonesian")
    ) || subtitles[0];

    const subtitleId = sub?.sd_id || sub?.id || sub?.subdl_id;
    if (!subtitleId) return null;

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
      try {
        const encoded = btoa(unescape(encodeURIComponent(text)));
        return { url: "data:text/srt;base64," + encoded };
      } catch (e) {
        return { url: dlUrl };
      }
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
    // FIX: Parameter harus &imdb= bukan &q=
    const searchUrl = "https://api.subsource.net/api/v1/movies/search?searchType=imdb&imdb=" + imdbId;
    
    console.log("[SubSource] Searching:", searchUrl);
    const searchRes = await fetch(searchUrl, {
      headers: { "X-API-Key": apiKey },
    });

    console.log("[SubSource] Search status:", searchRes.status);
    if (!searchRes.ok) {
      const errText = await searchRes.text();
      console.log("[SubSource] Error response:", errText);
      return null;
    }

    const searchData = await searchRes.json();
    const movies = searchData?.results || searchData?.data || searchData?.movies || [];
    console.log("[SubSource] Movies found:", movies.length);
    
    if (movies.length === 0) return null;

    const movie = movies[0];
    const movieId = movie?.id || movie?.subsource_id;
    
    if (!movieId) return null;

    const subUrl = "https://api.subsource.net/api/v1/subtitles?movieId=" + movieId + "&language=indonesian";
    console.log("[SubSource] Fetching subtitles:", subUrl);
    
    const subRes = await fetch(subUrl, {
      headers: { "X-API-Key": apiKey },
    });

    if (!subRes.ok) return null;

    const subData = await subRes.json();
    const subtitles = subData?.subtitles || subData?.data || [];
    console.log("[SubSource] Subtitles found:", subtitles.length);
    
    if (subtitles.length === 0) return null;

    const sub = subtitles[0];
    const subtitleId = sub?.id || sub?.subsource_id;
    
    if (!subtitleId) return null;

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
      return { url: dlUrl };
    }

    return null;
  } catch (err) {
    console.error("[SubSource] Error:", err);
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
    const title = searchParams.get("title");

    if (!tmdbId) {
      return NextResponse.json({ error: "Missing tmdb_id" }, { status: 400 });
    }

    console.log("========== SUBTITLE SEARCH ==========");
    console.log("TMDB ID:", tmdbId, "Type:", type, "Title:", title);

    // Dapatkan IMDB ID lebih awal supaya bisa dipakai di OpenSubtitles & SubSource
    const imdbId = await getImdbId(tmdbId, type);
    console.log("IMDB ID:", imdbId);

    // === 1. OpenSubtitles (Pakai TMDB & IMDB) ===
    console.log("[1/3] Trying OpenSubtitles...");
    const osResult = await searchOpenSubtitles(tmdbId, imdbId || "", type, season || "", episode || "");
    if (osResult) {
      console.log("[1/3] ✓ Found on OpenSubtitles");
      return NextResponse.json({
        success: true,
        source: "opensubtitles",
        subtitle_url: osResult.url,
      });
    }
    console.log("[1/3] ✗ Not found on OpenSubtitles");

    // === 2. SubDL ===
    if (title) {
      console.log("[2/3] Trying SubDL...");
      const subdlResult = await searchSubDL(title, type);
      if (subdlResult) {
        console.log("[2/3] ✓ Found on SubDL");
        return NextResponse.json({
          success: true,
          source: "subdl",
          subtitle_url: subdlResult.url,
        });
      }
      console.log("[2/3] ✗ Not found on SubDL");
    }

    // === 3. SubSource (Pakai IMDB ID) ===
    if (imdbId) {
      console.log("[3/3] Trying SubSource...");
      const ssResult = await searchSubSource(imdbId);
      if (ssResult) {
        console.log("[3/3] ✓ Found on SubSource");
        return NextResponse.json({
          success: true,
          source: "subsource",
          subtitle_url: ssResult.url,
        });
      }
      console.log("[3/3] ✗ Not found on SubSource");
    }

    console.log("========== NO SUBTITLE FOUND ==========");
    return NextResponse.json({
      success: false,
      message: "No Indonesian subtitle found from any source",
    }, { status: 404 });

  } catch (error: any) {
    console.error("[Subtitle Search] Error:", error);
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}
