import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Dapatkan IMDb ID dari TMDB ID (dibutuhkan SubSource)
async function getImdbId(tmdbId: string, type: string): Promise<string | null> {
  const apiKey = process.env.TMDB_API_KEY || process.env.NEXT_PUBLIC_TMDB_API_KEY;
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
// 1. SUBDL (Prioritas Utama - Paling Cepat & Akurat)
// Docs: https://subdl.com/developers
// Endpoint: GET /api/v2/subtitles/search
// Auth: Authorization: Bearer <key>
// ============================================================
async function searchSubDL(tmdbId: string, type: string, season: string, episode: string): Promise<{ url: string } | null> {
  const apiKey = (process.env.SUBDL_API_KEY || "").trim();
  if (!apiKey) return null;

  try {
    // Pakai endpoint subtitle search langsung dengan unpack=1
    let searchUrl = `https://api.subdl.com/api/v2/subtitles/search?tmdb_id=${tmdbId}&type=${type === "tv" ? "tv" : "movie"}&languages=id&unpack=1`;
    if (type === "tv" && season && episode) {
      searchUrl += `&season=${season}&episode=${episode}`;
    }

    console.log("[SubDL] Searching:", searchUrl);
    const res = await fetch(searchUrl, {
      headers: { 
        "Authorization": "Bearer " + apiKey,
        "Accept": "application/json"
      },
    });

    console.log("[SubDL] Status:", res.status);
    if (!res.ok) {
      console.log("[SubDL] Error:", await res.text());
      return null;
    }

    const data = await res.json();
    console.log("[SubDL] Response keys:", Object.keys(data));
    
    const subtitles = data?.subtitles || data?.data || [];
    console.log("[SubDL] Subtitles found:", subtitles.length);
    
    if (subtitles.length === 0) return null;

    // Karena pakai unpack=1, seharusnya ada URL download langsung
    const sub = subtitles[0];
    const dlUrl = sub?.url || sub?.download_url || sub?.link;
    
    if (dlUrl) {
      console.log("[SubDL] Found direct URL");
      return { url: dlUrl };
    }

    // Fallback: pakai endpoint download manual
    const subId = sub?.sd_id || sub?.id;
    if (subId) {
      const manualDlUrl = `https://api.subdl.com/api/v2/subtitles/${subId}/download`;
      console.log("[SubDL] Using manual download:", manualDlUrl);
      return { url: manualDlUrl };
    }

    return null;
  } catch (err) {
    console.error("[SubDL] Error:", err);
    return null;
  }
}

// ============================================================
// 2. SUBSOURCE (Prioritas Kedua - Pakai IMDb ID)
// Docs: https://subsource.net/api-docs
// Auth: X-API-Key: <key>
// ============================================================
async function searchSubSource(imdbId: string): Promise<{ url: string } | null> {
  const apiKey = (process.env.SUBSOURCE_API_KEY || "").trim();
  if (!apiKey) return null;

  try {
    // Step 1: Cari movie berdasarkan IMDb ID
    const searchUrl = `https://api.subsource.net/api/v1/movies/search?searchType=imdb&imdb=${imdbId}`;
    console.log("[SubSource] Movie Search:", searchUrl);
    
    const searchRes = await fetch(searchUrl, {
      headers: { "X-API-Key": apiKey },
    });

    console.log("[SubSource] Movie Search Status:", searchRes.status);
    if (!searchRes.ok) return null;

    const searchData = await searchRes.json();
    const movies = searchData?.results || searchData?.data || searchData?.movies || [];
    console.log("[SubSource] Movies found:", movies.length);
    
    if (movies.length === 0) return null;

    const movie = movies[0];
    const movieId = movie?.id || movie?._id || movie?.movieId;
    if (!movieId) return null;

    // Step 2: Ambil list subtitle (filter Indonesian)
    const subUrl = `https://api.subsource.net/api/v1/subtitles?movieId=${movieId}&language=indonesian`;
    console.log("[SubSource] Subtitle URL:", subUrl);
    
    const subRes = await fetch(subUrl, {
      headers: { "X-API-Key": apiKey },
    });

    console.log("[SubSource] Subtitle Status:", subRes.status);
    if (!subRes.ok) return null;

    const subData = await subRes.json();
    const subtitles = subData?.subtitles || subData?.data || [];
    console.log("[SubSource] Subtitles found:", subtitles.length);
    
    if (subtitles.length === 0) return null;

    // Ambil subtitle pertama
    const sub = subtitles[0];
    const subtitleId = sub?.id || sub?._id;
    if (!subtitleId) return null;

    // Step 3: Download URL
    const dlUrl = `https://api.subsource.net/api/v1/subtitles/${subtitleId}/download`;
    console.log("[SubSource] Download URL:", dlUrl);
    
    // SubSource butuh API key di header untuk download, jadi kita return URL endpoint-nya
    // Convert route akan handle fetch + API key
    return { url: dlUrl };
  } catch (err) {
    console.error("[SubSource] Error:", err);
    return null;
  }
}

// ============================================================
// 3. OPENSUBTITLES (Prioritas Terakhir - Sering 503 di Workers)
// Docs: https://opensubtitles.stoplight.io
// Auth: Api-Key header + User-Agent header
// ============================================================
async function searchOpenSubtitles(tmdbId: string, imdbId: string, type: string, season: string, episode: string): Promise<{ url: string } | null> {
  const apiKey = (process.env.OPENSUBTITLES_API_KEY || "").trim();
  if (!apiKey) return null;

  try {
    // Search subtitle
    let searchUrl = `https://api.opensubtitles.com/api/v1/subtitles?languages=id&tmdb_id=${tmdbId}`;
    if (type === "tv" && season && episode) {
      searchUrl += `&season_number=${season}&episode_number=${episode}`;
    }

    console.log("[OS] Searching:", searchUrl);
    let searchRes = await fetch(searchUrl, {
      headers: { "Api-Key": apiKey, "User-Agent": "CineStream v1.0" },
    });

    let subtitles = (await searchRes.json())?.data || [];

    // Fallback ke imdb_id
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

    // Coba download
    for (const sub of subtitles.slice(0, 3)) { // Cuma coba 3 pertama
      const fileId = sub?.attributes?.files?.[0]?.file_id;
      if (!fileId) continue;

      console.log("[OS] Trying file_id:", fileId);
      await new Promise(r => setTimeout(r, 1000)); // Delay 1s hindari rate limit

      const dlRes = await fetch("https://api.opensubtitles.com/api/v1/download", {
        method: "POST",
        headers: {
          "Api-Key": apiKey,
          "Content-Type": "application/json",
          "User-Agent": "CineStream v1.0",
        },
        body: JSON.stringify({ file_id: fileId }),
      });

      if (dlRes.status === 503 || dlRes.status === 429) {
        console.log("[OS] Rate limited");
        continue;
      }

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

    // Dapatkan IMDB ID untuk SubSource
    const imdbId = await getImdbId(tmdbId, type);
    console.log("IMDb:", imdbId);

    // 1. SubDL (Paling akurat untuk TMDB ID)
    console.log("[1/3] SubDL...");
    const subdlResult = await searchSubDL(tmdbId, type, season || "", episode || "");
    if (subdlResult) {
      console.log("✓ Found on SubDL");
      return NextResponse.json({ success: true, source: "subdl", subtitle_url: subdlResult.url });
    }

    // 2. SubSource (Pakai IMDb ID)
    if (imdbId) {
      console.log("[2/3] SubSource...");
      const ssResult = await searchSubSource(imdbId);
      if (ssResult) {
        console.log("✓ Found on SubSource");
        return NextResponse.json({ success: true, source: "subsource", subtitle_url: ssResult.url });
      }
    }

    // 3. OpenSubtitles (Fallback terakhir)
    console.log("[3/3] OpenSubtitles...");
    const osResult = await searchOpenSubtitles(tmdbId, imdbId || "", type, season || "", episode || "");
    if (osResult) {
      console.log("✓ Found on OpenSubtitles");
      return NextResponse.json({ success: true, source: "opensubtitles", subtitle_url: osResult.url });
    }

    console.log("✗ No subtitle found");
    return NextResponse.json({ success: false, message: "No subtitle found" }, { status: 404 });

  } catch (error: any) {
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}
