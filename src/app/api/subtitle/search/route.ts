import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

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
    return null;
  }
}

// 1. OpenSubtitles (dengan Retry)
async function searchOpenSubtitles(tmdbId: string, imdbId: string, type: string, season: string, episode: string): Promise<{ url: string } | null> {
  const apiKey = (process.env.OPENSUBTITLES_API_KEY || "").trim();
  if (!apiKey) return null;

  try {
    let searchUrl = "https://api.opensubtitles.com/api/v1/subtitles?languages=id&tmdb_id=" + tmdbId;
    if (type === "tv" && season && episode) {
      searchUrl += "&season_number=" + season + "&episode_number=" + episode;
    }

    let searchRes = await fetch(searchUrl, {
      headers: { "Api-Key": apiKey, "User-Agent": "CineStream v1.0" },
    });

    let searchData = await searchRes.json();
    let subtitles = searchData?.data || [];

    if (subtitles.length === 0 && imdbId) {
      searchUrl = "https://api.opensubtitles.com/api/v1/subtitles?languages=id&imdb_id=" + imdbId.replace("tt", "");
      if (type === "tv" && season && episode) {
        searchUrl += "&season_number=" + season + "&episode_number=" + episode;
      }
      searchRes = await fetch(searchUrl, {
        headers: { "Api-Key": apiKey, "User-Agent": "CineStream v1.0" },
      });
      searchData = await searchRes.json();
      subtitles = searchData?.data || [];
    }

    if (subtitles.length === 0) return null;

    const fileId = subtitles[0]?.attributes?.files?.[0]?.file_id;
    if (!fileId) return null;

    // Download dengan retry
    let dlRes;
    for (let i = 0; i < 3; i++) {
      dlRes = await fetch("https://api.opensubtitles.com/api/v1/download", {
        method: "POST",
        headers: {
          "Api-Key": apiKey,
          "Content-Type": "application/json",
          "User-Agent": "CineStream v1.0",
        },
        body: JSON.stringify({ file_id: fileId }),
      });
      if (dlRes.ok) break;
      console.log(`[OS] Download retry ${i+1}, status: ${dlRes.status}`);
      await new Promise(r => setTimeout(r, 1000)); // Tunggu 1 detik
    }

    if (!dlRes || !dlRes.ok) return null;

    const dlData = await dlRes.json();
    if (dlData?.link) return { url: dlData.link };

    return null;
  } catch (err) {
    return null;
  }
}

// 2. SubDL
async function searchSubDL(title: string, type: string): Promise<{ url: string } | null> {
  const apiKey = (process.env.SUBDL_API_KEY || "").trim();
  if (!apiKey) return null;

  try {
    const searchUrl = "https://api.subdl.com/api/v2/movies/search?q=" + encodeURIComponent(title) + "&type=" + (type === "tv" ? "tv" : "movie") + "&limit=5";
    
    const searchRes = await fetch(searchUrl, {
      headers: { "Authorization": "Bearer " + apiKey, "Accept": "application/json" },
    });

    if (!searchRes.ok) return null;

    const searchData = await searchRes.json();
    const movies = searchData?.results || searchData?.data || searchData?.movies || [];
    if (movies.length === 0) return null;

    const movie = movies[0];
    let subtitles = movie?.subtitles || [];
    
    if (subtitles.length === 0) {
      const movieId = movie?.sd_id || movie?.id || movie?.subdl_id;
      if (!movieId) return null;
      
      const subUrl = "https://api.subdl.com/api/v2/subtitles?film_id=" + movieId + "&language=id";
      const subRes = await fetch(subUrl, {
        headers: { "Authorization": "Bearer " + apiKey, "Accept": "application/json" },
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
      headers: { "Authorization": "Bearer " + apiKey, "Accept": "application/json" },
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
    return null;
  }
}

// 3. SubSource
async function searchSubSource(imdbId: string): Promise<{ url: string } | null> {
  const apiKey = (process.env.SUBSOURCE_API_KEY || "").trim();
  if (!apiKey) return null;

  try {
    const searchUrl = "https://api.subsource.net/api/v1/movies/search?searchType=imdb&imdb=" + imdbId;
    const searchRes = await fetch(searchUrl, {
      headers: { "X-API-Key": apiKey },
    });

    if (!searchRes.ok) return null;

    const searchData = await searchRes.json();
    const movies = searchData?.results || searchData?.data || searchData?.movies || [];
    if (movies.length === 0) return null;

    const movie = movies[0];
    const movieId = movie?.id || movie?.subsource_id;
    if (!movieId) return null;

    // Hapus filter language=indonesian karena bikin 0 result. Ambil semua dulu.
    const subUrl = "https://api.subsource.net/api/v1/subtitles?movieId=" + movieId;
    const subRes = await fetch(subUrl, {
      headers: { "X-API-Key": apiKey },
    });

    if (!subRes.ok) return null;

    const subData = await subRes.json();
    const subtitles = subData?.subtitles || subData?.data || [];
    if (subtitles.length === 0) return null;

    // Filter manual untuk cari bahasa Indonesia
    const sub = subtitles.find((s: any) => 
      s?.language?.toLowerCase().includes("indonesian") || 
      s?.lang?.toLowerCase().includes("indonesian") ||
      s?.language?.toLowerCase().includes("id") ||
      s?.lang?.toLowerCase().includes("id")
    );

    if (!sub) return null;

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
    return null;
  }
}

// MAIN
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tmdbId = searchParams.get("tmdb_id");
    const type = searchParams.get("type") || "movie";
    const season = searchParams.get("season");
    const episode = searchParams.get("episode");
    const title = searchParams.get("title");

    if (!tmdbId) return NextResponse.json({ error: "Missing tmdb_id" }, { status: 400 });

    const imdbId = await getImdbId(tmdbId, type);

    // 1. OpenSubtitles
    const osResult = await searchOpenSubtitles(tmdbId, imdbId || "", type, season || "", episode || "");
    if (osResult) return NextResponse.json({ success: true, source: "opensubtitles", subtitle_url: osResult.url });

    // 2. SubDL
    if (title) {
      const subdlResult = await searchSubDL(title, type);
      if (subdlResult) return NextResponse.json({ success: true, source: "subdl", subtitle_url: subdlResult.url });
    }

    // 3. SubSource
    if (imdbId) {
      const ssResult = await searchSubSource(imdbId);
      if (ssResult) return NextResponse.json({ success: true, source: "subsource", subtitle_url: ssResult.url });
    }

    return NextResponse.json({ success: false, message: "No subtitle found" }, { status: 404 });

  } catch (error: any) {
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}
