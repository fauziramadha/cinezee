import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_KEY = process.env.TMDB_API_KEY || process.env.NEXT_PUBLIC_TMDB_API_KEY || "";
const TMDB_IMG = "https://image.tmdb.org/t/p";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const CACHE_TTL = 5 * 60; // 5 menit

async function getDB() {
  try {
    const ctx = await getCloudflareContext();
    return (ctx.env as any)?.DB || null;
  } catch { return null; }
}

async function tmdbFetch(path: string): Promise<any | null> {
  if (!TMDB_KEY) return null;
  try {
    const url = new URL(`${TMDB_BASE}${path}`);
    url.searchParams.set("api_key", TMDB_KEY);
    url.searchParams.set("language", "en-US");
    const r = await fetch(url.toString(), {
      headers: { "User-Agent": UA, "Accept": "application/json" },
    });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

function imgUrl(path?: string | null, size: string = "w342"): string {
  if (!path) return "/placeholder-poster.png";
  return `${TMDB_IMG}/${size}${path}`;
}

async function getVidapiIds(type: "movie" | "tv"): Promise<Set<string>> {
  const cache = (caches as any).default;
  const cacheKey = new Request(`https://internal/vidapi-ids-${type}`);
  const cached = await cache.match(cacheKey);
  if (cached) {
    const data = await cached.json();
    return new Set(data.ids);
  }

  const filename = type === "movie" ? "movie_list_tmdb.txt" : "tv_list_tmdb.txt";
  try {
    const r = await fetch(`https://vidapi.ru/ids/${filename}`, {
      headers: { "User-Agent": UA },
    });
    if (!r.ok) return new Set();
    const text = await r.text();
    const ids = new Set(text.split("\n").map(s => s.trim()).filter(Boolean));
    
    const response = new Response(JSON.stringify({ ids: Array.from(ids) }), {
      headers: { "Content-Type": "application/json", "Cache-Control": `public, s-maxage=1800` },
    });
    await cache.put(cacheKey, response.clone());
    return ids;
  } catch { return new Set(); }
}

// ============================================================
// Fetch VidAPI latest (STRICTLY 2026+, fetch 5 pages to get enough items)
// ============================================================
async function fetchVidapiLatest(type: "movie" | "tv", maxItems = 15) {
  const endpoint = type === "movie" ? "movies" : "tvshows";
  const allItems: any[] = [];
  
  // Fetch 5 pages paralel untuk mengumpulkan kandidat
  const pages = [1, 2, 3, 4, 5];
  const results = await Promise.all(
    pages.map(async (page) => {
      try {
        const r = await fetch(`https://vidapi.ru/${endpoint}/latest/page-${page}.json`);
        if (!r.ok) return [];
        const data = await r.json();
        return data.items || [];
      } catch { return []; }
    })
  );
  results.forEach(items => allItems.push(...items));

  // Filter KETAT: tahun HARUS 2026 ke atas
  return allItems
    .filter((item: any) => 
      item.tmdb_id && 
      item.poster_url && 
      parseInt(item.year || "0", 10) >= 2026
    )
    .slice(0, maxItems)
    .map((item: any) => ({
      id: item.imdb_id || `tmdb-${item.tmdb_id}`,
      tmdbId: parseInt(item.tmdb_id, 10) || 0,
      imdbId: item.imdb_id || undefined,
      title: item.title || "Untitled",
      type,
      poster: item.poster_url.replace("/original/", "/w342/").replace("/w500/", "/w342/"),
      backdrop: item.poster_url.replace("/original/", "/w1280/").replace("/w500/", "/w1280/"),
      overview: "",
      year: item.year || "",
      rating: parseFloat(item.rating) || 0,
      genre: item.genre || undefined,
    }));
}

// ============================================================
// Fetch latest episodes (STRICTLY 2026+, SORT BY DATE DESCENDING)
// ============================================================
async function fetchLatestEpisodes(maxItems = 15) {
  try {
    const allEps: any[] = [];
    
    // Fetch 5 pages paralel
    const pages = [1, 2, 3, 4, 5];
    const results = await Promise.all(
      pages.map(async (page) => {
        try {
          const r = await fetch(`https://vidapi.ru/episodes/latest/page-${page}.json`);
          if (!r.ok) return [];
          const data = await r.json();
          return data.items || [];
        } catch { return []; }
      })
    );
    results.forEach(items => allEps.push(...items));

    // Filter: hanya 2026+ dan ada show_tmdb_id
    const eps = allEps
      .filter((e: any) => e.show_tmdb_id && (e.air_date || "").startsWith("2026-"))
      .sort((a, b) => {
        // Sort descending: tanggal terbaru di atas
        const dateA = new Date(a.air_date).getTime();
        const dateB = new Date(b.air_date).getTime();
        return dateB - dateA;
      })
      .slice(0, maxItems);

    const showCache = new Map<number, string>();
    const result = [];
    const batchSize = 5;
    
    for (let i = 0; i < eps.length; i += batchSize) {
      const batch = eps.slice(i, i + batchSize);
      const enriched = await Promise.all(
        batch.map(async (ep: any) => {
          const showTmdbId = parseInt(ep.show_tmdb_id, 10) || 0;
          const item: any = {
            showTmdbId,
            showImdbId: ep.show_imdb_id,
            showTitle: ep.show_title,
            season: ep.season_number,
            episode: ep.episode_number,
            episodeTitle: ep.episode_title,
            airDate: ep.air_date,
            embedUrl: ep.embed_url,
          };
          if (showTmdbId > 0) {
            try {
              const detail = await tmdbFetch(`/tv/${showTmdbId}/season/${item.season}/episode/${item.episode}`);
              if (detail?.still_path) item.still = imgUrl(detail.still_path, "w300");
              if (detail?.overview) item.overview = detail.overview;
            } catch {}
          }
          if (!item.still && showTmdbId > 0) {
            if (showCache.has(showTmdbId)) {
              item.still = showCache.get(showTmdbId);
            } else {
              try {
                const show = await tmdbFetch(`/tv/${showTmdbId}`);
                if (show?.backdrop_path) {
                  const bd = imgUrl(show.backdrop_path, "w300");
                  showCache.set(showTmdbId, bd);
                  item.still = bd;
                }
              } catch {}
            }
          }
          return item;
        })
      );
      result.push(...enriched);
    }
    return result;
  } catch { return []; }
}

async function fetchHero(movieIds: Set<string>, tvIds: Set<string>, maxItems = 10) {
  const data = await tmdbFetch("/trending/all/week");
  if (!data?.results) return [];

  const filtered = data.results.filter((m: any) => {
    const type = m.media_type;
    if (type !== "movie" && type !== "tv") return false;
    if (!m.backdrop_path) return false;
    const ids = type === "movie" ? movieIds : tvIds;
    return ids.has(String(m.id));
  }).slice(0, maxItems);

  const batchSize = 5;
  const enriched = [];
  for (let i = 0; i < filtered.length; i += batchSize) {
    const batch = filtered.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (m: any) => {
        const type = m.media_type;
        const detail = await tmdbFetch(`/${type}/${m.id}?append_to_response=external_ids,images&include_image_language=en,null`);
        const logo = detail?.images?.logos?.find((l: any) => l.iso_639_1 === "en") || detail?.images?.logos?.[0];
        return {
          id: detail?.external_ids?.imdb_id || `tmdb-${m.id}`,
          tmdbId: m.id,
          imdbId: detail?.external_ids?.imdb_id,
          title: detail?.title || detail?.name || m.title || m.name || "Untitled",
          type,
          poster: imgUrl(detail?.poster_path || m.poster_path, "w342"),
          backdrop: imgUrl(detail?.backdrop_path || m.backdrop_path, "w1280"),
          logo: logo ? imgUrl(logo.file_path, "w500") : undefined,
          overview: detail?.overview || m.overview || "",
          year: (detail?.release_date || detail?.first_air_date || "").slice(0, 4),
          rating: detail?.vote_average || m.vote_average || 0,
          genre: detail?.genres?.length ? detail.genres.map((g: any) => g.name).join(", ") : undefined,
          seasons: type === "tv" && detail?.seasons
            ? detail.seasons.filter((s: any) => s.season_number > 0).map((s: any) => ({
                seasonNumber: s.season_number, episodeCount: s.episode_count, name: s.name,
              }))
            : undefined,
        };
      })
    );
    enriched.push(...results);
  }
  return enriched;
}

async function fetchPopular(movieIds: Set<string>, maxItems = 15) {
  const data = await tmdbFetch("/movie/popular");
  if (!data?.results) return [];

  return data.results
    .filter((m: any) => movieIds.has(String(m.id)) && m.poster_path)
    .slice(0, maxItems)
    .map((m: any) => ({
      id: `tmdb-${m.id}`,
      tmdbId: m.id,
      imdbId: undefined,
      title: m.title || "Untitled",
      type: "movie",
      poster: imgUrl(m.poster_path, "w342"),
      backdrop: imgUrl(m.backdrop_path, "w1280"),
      overview: m.overview || "",
      year: (m.release_date || "").slice(0, 4),
      rating: m.vote_average || 0,
      genre: m.genre_ids?.length ? String(m.genre_ids[0]) : undefined,
    }));
}

export async function GET() {
  try {
    const db = await getDB();
    const cacheKey = "home:all_data";

    // 1. Cek D1 cache
    if (db) {
      try {
        const row = await db.prepare(
          "SELECT cache_value FROM api_cache WHERE cache_key = ? AND expires_at > ?"
        ).bind(cacheKey, Date.now()).first();
        
        if (row?.cache_value) {
          console.log("[Home API] D1 CACHE HIT");
          return NextResponse.json(JSON.parse(row.cache_value as string), {
            headers: { "Cache-Control": "public, max-age=60" },
          });
        }
      } catch (e) {
        console.warn("[Home API] D1 read error:", e);
      }
    }

    // 2. Fetch semua data paralel
    console.log("[Home API] Cache MISS, fetching fresh data...");
    const [movieIds, tvIds, vidapiMovies, vidapiTV, vidapiEps] = await Promise.all([
      getVidapiIds("movie"),
      getVidapiIds("tv"),
      fetchVidapiLatest("movie", 15),
      fetchVidapiLatest("tv", 15),
      fetchLatestEpisodes(15),
    ]);

    const [hero, popular] = await Promise.all([
      fetchHero(movieIds, tvIds, 10),
      fetchPopular(movieIds, 15),
    ]);

    const result = {
      hero,
      movies: vidapiMovies,
      popularMovies: popular,
      tvShows: vidapiTV,
      episodes: vidapiEps,
    };

    // 3. Simpan ke D1 cache (5 menit)
    if (db) {
      try {
        await db.prepare(
          "INSERT OR REPLACE INTO api_cache (cache_key, cache_value, expires_at) VALUES (?, ?, ?)"
        ).bind(cacheKey, JSON.stringify(result), Date.now() + CACHE_TTL * 1000).run();
        console.log("[Home API] Stored in D1 cache (5 min)");
      } catch (e) {
        console.warn("[Home API] D1 write error:", e);
      }
    }

    return NextResponse.json(result, {
      headers: { "Cache-Control": "public, max-age=60" },
    });

  } catch (err: any) {
    console.error("[Home API] Error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
