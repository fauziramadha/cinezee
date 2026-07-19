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

export async function fetchLatestMovies(page = 1): Promise<VidapiListResponse<VidapiMovie>> {
  const url = `${VIDAPI_BASE}/movies/latest/page-${page}.json`;
  const r = await fetch(url, { headers: { "Accept": "application/json" } });
  if (!r.ok) throw new Error(`Failed to fetch movies: ${r.status}`);
  return r.json();
}

export async function fetchLatestTVShows(page = 1): Promise<VidapiListResponse<VidapiTVShow>> {
  const url = `${VIDAPI_BASE}/tvshows/latest/page-${page}.json`;
  const r = await fetch(url, { headers: { "Accept": "application/json" } });
  if (!r.ok) throw new Error(`Failed to fetch TV shows: ${r.status}`);
  return r.json();
}

export async function fetchLatestEpisodes(page = 1): Promise<VidapiListResponse<VidapiEpisode>> {
  const url = `${VIDAPI_BASE}/episodes/latest/page-${page}.json`;
  const r = await fetch(url, { headers: { "Accept": "application/json" } });
  if (!r.ok) throw new Error(`Failed to fetch episodes: ${r.status}`);
  return r.json();
}

export function getTMDBImage(url: string, size: "w185" | "w342" | "w500" | "w1280" | "original" = "w342"): string {
  if (!url) return "/placeholder-poster.png";
  return url.replace(/\/t\/p\/(w\d+|original)\//, `/t/p/${size}/`);
}
