const VIDAPI_BASE = "https://vidapi.ru";

export interface VidapiMovie {
  tmdb_id: string;
  imdb_id: string | null;
  title: string;
  year: string;
  poster_url: string;
  rating: string;
  genre: string;
  popularity: string;
  type: "movie";
  embed_url: string;
}

export interface VidapiTVShow {
  tmdb_id: string;
  imdb_id: string | null;
  title: string;
  year: string;
  poster_url: string;
  rating: string;
  genre: string;
  popularity: string;
  type: "tv";
  embed_url: string;
}

export interface VidapiEpisode {
  show_tmdb_id: string;
  season_number: string;
  episode_number: string;
  episode_title: string;
  air_date: string;
  show_title: string;
  show_imdb_id: string | null;
  type: "episode";
  embed_url: string;
}

export interface VidapiListResponse<T> {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
  items: T[];
}

// ============================================================
// Fetch dengan retry + filter
// ============================================================
async function fetchVidapi<T>(path: string): Promise<VidapiListResponse<T>> {
  const url = `${VIDAPI_BASE}${path}`;
  const r = await fetch(url, {
    headers: { "Accept": "application/json" },
  });
  if (!r.ok) throw new Error(`VidAPI error: ${r.status}`);
  return r.json();
}

// ============================================================
// Latest Movies (urut popularity descending, filter rating > 0)
// ============================================================
export async function fetchLatestMovies(page = 1, minRating = 1.0): Promise<VidapiMovie[]> {
  const data = await fetchVidapi<VidapiMovie>(`/movies/latest/page-${page}.json`);
  // Filter: rating > minRating, ada imdb_id, ada poster
  const filtered = data.items.filter(m =>
    parseFloat(m.rating) >= minRating &&
    m.imdb_id &&
    m.poster_url
  );
  // Sort by popularity descending
  return filtered.sort((a, b) => parseFloat(b.popularity) - parseFloat(a.popularity));
}

// ============================================================
// Latest TV Shows
// ============================================================
export async function fetchLatestTVShows(page = 1, minRating = 1.0): Promise<VidapiTVShow[]> {
  const data = await fetchVidapi<VidapiTVShow>(`/tvshows/latest/page-${page}.json`);
  const filtered = data.items.filter(t =>
    parseFloat(t.rating) >= minRating &&
    t.poster_url
  );
  return filtered.sort((a, b) => parseFloat(b.popularity) - parseFloat(a.popularity));
}

// ============================================================
// Latest Episodes
// ============================================================
export async function fetchLatestEpisodes(page = 1): Promise<VidapiEpisode[]> {
  const data = await fetchVidapi<VidapiEpisode>(`/episodes/latest/page-${page}.json`);
  return data.items.filter(e => e.show_imdb_id);
}

// ============================================================
// TMDB enrich: tambah sinopsis + genre + backdrop ke item VidAPI
// ============================================================
export interface EnrichedMediaItem {
  id: string;
  tmdbId: number;
  imdbId?: string;
  title: string;
  type: "movie" | "tv";
  poster: string;
  backdrop: string;
  overview: string;
  year: string;
  rating: number;
  genre?: string;
  embed_url: string;
  seasons?: Array<{
    seasonNumber: number;
    episodeCount: number;
    name?: string;
  }>;
}

const TMDB_IMG = "https://image.tmdb.org/t/p";

// Batch enrich: fetch detail TMDB untuk multiple items sekaligus (paralel)
export async function enrichWithTMDB(
  items: VidapiMovie[] | VidapiTVShow[],
  type: "movie" | "tv",
): Promise<EnrichedMediaItem[]> {
  const TMDB_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY || "";
  
  // Fetch semua detail paralel (max 10 concurrent untuk hindari rate limit)
  const batchSize = 10;
  const results: EnrichedMediaItem[] = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const enriched = await Promise.all(
      batch.map(async (item) => {
        // Basic data dari VidAPI
        const basic: EnrichedMediaItem = {
          id: item.imdb_id || `tmdb-${item.tmdb_id}`,
          tmdbId: parseInt(item.tmdb_id, 10) || 0,
          imdbId: item.imdb_id || undefined,
          title: item.title,
          type,
          poster: item.poster_url,
          backdrop: item.poster_url.replace("/w500/", "/w1280/").replace("/original/", "/w1280/"),
          overview: "", // akan diisi dari TMDB
          year: item.year,
          rating: parseFloat(item.rating) || 0,
          genre: item.genre,
          embed_url: item.embed_url,
        };

        // Coba fetch TMDB detail untuk dapat overview + backdrop + seasons
        if (basic.tmdbId > 0 && TMDB_KEY) {
          try {
            const tmdbUrl = `https://api.themoviedb.org/3/${type}/${basic.tmdbId}?api_key=${TMDB_KEY}&language=en-US&append_to_response=external_ids`;
            const r = await fetch(tmdbUrl);
            if (r.ok) {
              const data = await r.json();
              if (data.overview) basic.overview = data.overview;
              if (data.backdrop_path) basic.backdrop = `${TMDB_IMG}/w1280${data.backdrop_path}`;
              if (data.poster_path) basic.poster = `${TMDB_IMG}/w342${data.poster_path}`;
              if (data.vote_average) basic.rating = data.vote_average;
              if (data.genres?.length) basic.genre = data.genres.map((g: any) => g.name).join(", ");
              if (data.imdb_id) basic.imdbId = data.imdb_id;
              if (type === "tv" && data.seasons) {
                basic.seasons = data.seasons
                  .filter((s: any) => s.season_number > 0)
                  .map((s: any) => ({
                    seasonNumber: s.season_number,
                    episodeCount: s.episode_count,
                    name: s.name,
                  }));
              }
            }
          } catch (e) {
            console.warn(`[TMDB enrich] failed for ${item.tmdb_id}:`, e);
          }
        }

        return basic;
      })
    );
    results.push(...enriched);
  }
  
  return results;
}

// ============================================================
// Image URL helper
// ============================================================
export function getTMDBImage(url: string, size: "w185" | "w342" | "w500" | "w1280" | "original" = "w342"): string {
  if (!url) return "/placeholder-poster.png";
  return url.replace(/\/t\/p\/(w\d+|original)\//, `/t/p/${size}/`);
}
