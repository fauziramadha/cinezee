import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// ============================================================
// HELPER: Get IMDb ID from TMDB ID
// ============================================================
async function getImdbId(tmdbId: string, type: string): Promise<string | null> {
  const apiKey = process.env.TMDB_API_KEY || process.env.NEXT_PUBLIC_TMDB_API_KEY;
  if (!apiKey) {
    console.log("[TMDB] No API key found");
    return null;
  }

  try {
    const url = `https://api.themoviedb.org/3/${type}/${tmdbId}/external_ids?api_key=${apiKey}`;
    console.log("[TMDB] Fetching:", url);
    const res = await fetch(url);
    if (!res.ok) {
      console.log("[TMDB] Response not OK:", res.status);
      return null;
    }
    const data = await res.json();
    console.log("[TMDB] Got IMDB ID:", data?.imdb_id);
    return data?.imdb_id || null;
  } catch (err) {
    console.error("[TMDB] Error:", err);
    return null;
  }
}

// ============================================================
// 1. OPENSUBTITLES
// ============================================================
async function searchOpenSubtitles(tmdbId: string, type: string, season: string, episode: string): Promise<{ url: string } | null> {
  const apiKey = process.env.OPENSUBTITLES_API_KEY;
  if (!apiKey) {
    console.log("[OS] No API key");
    return null;
  }

  try {
    let searchUrl = "https://api.opensubtitles.com/api/v1/subtitles?tmdb_id=" + tmdbId + "&languages=id";
    if (type === "tv" && season && episode) {
      searchUrl += "&season_number=" + season + "&episode_number=" + episode;
    }

    console.log("[OS] Searching:", searchUrl);
    const searchRes = await fetch(searchUrl, {
      headers: {
        "Api-Key": apiKey,
        "User-Agent": "CineStream v1.0",
      },
    });

    console.log("[OS] Search status:", searchRes.status);
    if (!searchRes.ok) {
      const errText = await searchRes.text();
      console.log("[OS] Error response:", errText);
      return null;
    }

    const searchData = await searchRes.json();
    const subtitles = searchData?.data || [];
    console.log("[OS] Found subtitles:", subtitles.length);

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
  if (!apiKey) {
    console.log("[SubDL] No API key");
    return null;
  }

  try {
    // Step 1: Search movie by title
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
    console.log("[SubDL] Search response keys:", Object.keys(searchData));
    
    const movies = searchData?.results || searchData?.data || searchData?.movies || [];
    console.log("[SubDL] Movies found:", movies.length);
    
    if (movies.length === 0) return null;

    const movie = movies[0];
    console.log("[SubDL] Movie data:", JSON.stringify(movie).substring(0, 200));
    
    // SubDL movie search mungkin langsung return subtitles di result
    // Cek jika ada subtitles di movie object
    let subtitles = movie?.subtitles || [];
    
    if (subtitles.length === 0) {
      // Coba ambil subtitle ID dari movie
      const movieId = movie?.sd_id || movie?.id || movie?.subdl_id;
      console.log("[SubDL] Movie ID:", movieId);
      
      if (!movieId) return null;
      
      // Langsung pakai endpoint download jika ada subtitle list di movie
      // Atau coba pakai endpoint subtitles dengan film_id
      const subUrl = "https://api.subdl.com/api/v2/subtitles?film_id=" + movieId + "&language=id";
      console.log("[SubDL] Fetching subtitles:", subUrl);
      
      const subRes = await fetch(subUrl, {
        headers: { "Authorization": "Bearer " + apiKey },
      });
      
      console.log("[SubDL] Subtitle list status:", subRes.status);
      if (!subRes.ok) {
        const errText = await subRes.text();
        console.log("[SubDL] Subtitle error:", errText);
        return null;
      }
      
      const subData = await subRes.json();
      console.log("[SubDL] Sub response keys:", Object.keys(subData));
      subtitles = subData?.subtitles || subData?.data || [];
    }
    
    console.log("[SubDL] Subtitles found:", subtitles.length);
    if (subtitles.length === 0) return null;

    // Cari subtitle Indonesia
    const sub = subtitles.find((s: any) => 
      s?.language?.toLowerCase().includes("id") || 
      s?.lang?.toLowerCase().includes("id") ||
      s?.language?.toLowerCase().includes("indonesian") ||
      s?.language?.toLowerCase().includes("ind")
    ) || subtitles[0];

    console.log("[SubDL] Selected sub:", JSON.stringify(sub).substring(0, 200));
    
    const subtitleId = sub?.sd_id || sub?.id || sub?.subdl_id;
    console.log("[SubDL] Subtitle ID:", subtitleId);
    
    if (!subtitleId) return null;

    // Download subtitle
    const dlUrl = "https://api.subdl.com/api/v2/subtitles/" + subtitleId + "/download?format=file";
    console.log("[SubDL] Downloading:", dlUrl);
    
    const dlRes = await fetch(dlUrl, {
      headers: { "Authorization": "Bearer " + apiKey },
    });

    console.log("[SubDL] Download status:", dlRes.status);
    if (!dlRes.ok) return null;

    const contentType = dlRes.headers.get("content-type") || "";
    console.log("[SubDL] Content-Type:", contentType);
    
    if (contentType.includes("json")) {
      const dlData = await dlRes.json();
      const link = dlData?.link || dlData?.url || dlData?.download_url;
      console.log("[SubDL] Download link:", link ? "YES" : "NO");
      if (link) return { url: link };
    } else {
      // Response langsung berisi SRT file
      // Bungkus sebagai data URL (tanpa Buffer, pakai btoa)
      const text = await dlRes.text();
      try {
        // Encode UTF-8 safe
        const encoded = btoa(unescape(encodeURIComponent(text)));
        return { url: "data:text/srt;base64," + encoded };
      } catch (e) {
        console.log("[SubDL] btoa failed, returning raw text URL");
        // Fallback: return sebagai URL proxy
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
  if (!apiKey) {
    console.log("[SubSource] No API key");
    return null;
  }

  try {
    // Step 1: Search movie by IMDb ID
    const searchUrl = "https://api.subsource.net/api/v1/movies/search?searchType=imdb&q=" + imdbId;
    
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
    console.log("[SubSource] Search response keys:", Object.keys(searchData));
    
    const movies = searchData?.results || searchData?.data || searchData?.movies || [];
    console.log("[SubSource] Movies found:", movies.length);
    
    if (movies.length === 0) return null;

    const movie = movies[0];
    console.log("[SubSource] Movie data:", JSON.stringify(movie).substring(0, 200));
    
    const movieId = movie?.id || movie?.subsource_id;
    console.log("[SubSource] Movie ID:", movieId);
    
    if (!movieId) return null;

    // Step 2: Get subtitles (filter Indonesian)
    const subUrl = "https://api.subsource.net/api/v1/subtitles?movieId=" + movieId + "&language=indonesian";
    console.log("[SubSource] Fetching subtitles:", subUrl);
    
    const subRes = await fetch(subUrl, {
      headers: { "X-API-Key": apiKey },
    });

    console.log("[SubSource] Subtitle list status:", subRes.status);
    if (!subRes.ok) {
      const errText = await subRes.text();
      console.log("[SubSource] Subtitle error:", errText);
      return null;
    }

    const subData = await subRes.json();
    console.log("[SubSource] Sub response keys:", Object.keys(subData));
    
    const subtitles = subData?.subtitles || subData?.data || [];
    console.log("[SubSource] Subtitles found:", subtitles.length);
    
    if (subtitles.length === 0) return null;

    const sub = subtitles[0];
    console.log("[SubSource] Selected sub:", JSON.stringify(sub).substring(0, 200));
    
    const subtitleId = sub?.id || sub?.subsource_id;
    console.log("[SubSource] Subtitle ID:", subtitleId);
    
    if (!subtitleId) return null;

    // Step 3: Download subtitle
    const dlUrl = "https://api.subsource.net/api/v1/subtitles/" + subtitleId + "/download";
    console.log("[SubSource] Downloading:", dlUrl);
    
    const dlRes = await fetch(dlUrl, {
      headers: { "X-API-Key": apiKey },
    });

    console.log("[SubSource] Download status:", dlRes.status);
    if (!dlRes.ok) return null;

    const contentType = dlRes.headers.get("content-type") || "";
    console.log("[SubSource] Content-Type:", contentType);
    
    if (contentType.includes("json")) {
      const dlData = await dlRes.json();
      const link = dlData?.link || dlData?.url || dlData?.download_url;
      console.log("[SubSource] Download link:", link ? "YES" : "NO");
      if (link) return { url: link };
    } else if (contentType.includes("zip") || contentType.includes("octet-stream")) {
      // ZIP file - return URL untuk convert route
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
    console.log("TMDB ID:", tmdbId);
    console.log("Type:", type);
    console.log("Title:", title);
    console.log("Season:", season, "Episode:", episode);
    console.log("=====================================");

    // Cek API keys
    console.log("API Keys available:");
    console.log("- OPENSUBTITLES_API_KEY:", process.env.OPENSUBTITLES_API_KEY ? "YES" : "NO");
    console.log("- SUBDL_API_KEY:", process.env.SUBDL_API_KEY ? "YES" : "NO");
    console.log("- SUBSOURCE_API_KEY:", process.env.SUBSOURCE_API_KEY ? "YES" : "NO");
    console.log("- TMDB_API_KEY:", (process.env.TMDB_API_KEY || process.env.NEXT_PUBLIC_TMDB_API_KEY) ? "YES" : "NO");
    console.log("=====================================");

    // === 1. OpenSubtitles ===
    console.log("[1/3] Trying OpenSubtitles...");
    const osResult = await searchOpenSubtitles(tmdbId, type, season || "", episode || "");
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

    // === 3. SubSource ===
    console.log("[3/3] Trying SubSource...");
    const imdbId = await getImdbId(tmdbId, type);
    if (imdbId) {
      console.log("[3/3] Got IMDb ID:", imdbId);
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
    } else {
      console.log("[3/3] ✗ Failed to get IMDb ID");
    }

    // === Tidak ada subtitle ===
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
