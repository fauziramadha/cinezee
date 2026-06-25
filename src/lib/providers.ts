/**
 * Multi-provider streaming configuration
 * Server 1 & 2: FilmU (Premium API Key + Debug Mode)
 * Server 3-8: Fallback providers (Vidking, VidLink, etc.)
 */

export type MediaType = "movie" | "tv";

export interface Provider {
  name: string;
  baseUrl: string;
  /** 0 = clean, 10 = brutal */
  brutality: number;
  /** Whether iframe sandbox can be used (all are false based on investigation) */
  supportsSandbox: boolean;
  /** Build the streaming URL for this provider */
  buildUrl: (
    id: number,
    type: MediaType,
    season?: number,
    episode?: number,
    imdbId?: string,
  ) => string;
}

export const PROVIDERS: Provider[] = [
  // Server 1: FilmU Premium (No ads via API Key)
  {
    name: "Server 1",
    baseUrl: "https://embed.filmu.in",
    brutality: 0,
    supportsSandbox: false,
    buildUrl: (id, type, season, episode) => {
      const apiKey = process.env.FILMU_PREMIUM_KEY || "zyflix_premium_9x8c7v6b5n";
      return type === "movie"
        ? `https://embed.filmu.in/movie/${id}?apikey=${apiKey}`
        : `https://embed.filmu.in/tv/${id}/${season}/${episode}?apikey=${apiKey}`;
    },
  },
  // Server 2: FilmU Debug Mode (No ads via debug bypass)
  {
    name: "Server 2",
    baseUrl: "https://embed.filmu.in",
    brutality: 0,
    supportsSandbox: false,
    buildUrl: (id, type, season, episode) =>
      type === "movie"
        ? `https://embed.filmu.in/movie/${id}?debug=savu`
        : `https://embed.filmu.in/tv/${id}/${season}/${episode}?debug=savu`,
  },
  // Server 3: Vidking (0 ads, verified)
  {
    name: "Server 3",
    baseUrl: "https://www.vidking.net/embed",
    brutality: 0,
    supportsSandbox: false,
    buildUrl: (id, type, season, episode) =>
      type === "movie"
        ? `https://www.vidking.net/embed/movie/${id}`
        : `https://www.vidking.net/embed/tv/${id}/${season}/${episode}`,
  },
  // Server 4: VidLink (1 ad, customizable)
  {
    name: "Server 4",
    baseUrl: "https://vidlink.pro",
    brutality: 1,
    supportsSandbox: false,
    buildUrl: (id, type, season, episode) => {
      const params =
        "primaryColor=B20710&secondaryColor=FFFFFF&iconColor=FFD700&title=true&poster=true&autoplay=false";
      return type === "movie"
        ? `https://vidlink.pro/movie/${id}?${params}`
        : `https://vidlink.pro/tv/${id}/${season}/${episode}?${params}&nextbutton=true`;
    },
  },
  // Server 5: MultiEmbed (1-2 ads)
  {
    name: "Server 5",
    baseUrl: "https://multiembed.mov",
    brutality: 2,
    supportsSandbox: false,
    buildUrl: (id, type, season, episode) =>
      type === "movie"
        ? `https://multiembed.mov/?video_id=${id}&tmdb=1`
        : `https://multiembed.mov/?video_id=${id}&tmdb=1&s=${season}&e=${episode}`,
  },
  // Server 6: VidFast (1-3 ads, click popunder)
  {
    name: "Server 6",
    baseUrl: "https://vidfast.pro",
    brutality: 4,
    supportsSandbox: false,
    buildUrl: (id, type, season, episode) =>
      type === "movie"
        ? `https://vidfast.pro/movie/${id}?theme=B20710&autoPlay=false&poster=true&title=true`
        : `https://vidfast.pro/tv/${id}/${season}/${episode}?theme=B20710&autoPlay=false&nextButton=true&poster=true&title=true`,
  },
  // Server 7: VidSrc (3 ads)
  {
    name: "Server 7",
    baseUrl: "https://vidsrc-embed.ru",
    brutality: 3,
    supportsSandbox: false,
    buildUrl: (id, type, season, episode, imdbId) => {
      const videoId = imdbId || id;
      return type === "movie"
        ? `https://vidsrc-embed.ru/embed/movie/${videoId}`
        : `https://vidsrc-embed.ru/embed/tv/${videoId}/${season}-${episode}`;
    },
  },
  // Server 8: Vidrock (6 ads, last resort)
  {
    name: "Server 8",
    baseUrl: "https://vidrock.ru",
    brutality: 6,
    supportsSandbox: false,
    buildUrl: (id, type, season, episode) =>
      type === "movie"
        ? `https://vidrock.ru/movie/${id}`
        : `https://vidrock.ru/tv/${id}/${season}/${episode}`,
  },
];

export interface ProviderUrl {
  name: string;
  brutality: number;
  url: string;
}

/**
 * Get streaming URLs from all providers for a given media
 */
export function getProviderUrls(
  id: number,
  type: MediaType,
  season?: number,
  episode?: number,
  imdbId?: string,
): ProviderUrl[] {
  return PROVIDERS.map((p) => ({
    name: p.name,
    brutality: p.brutality,
    url: p.buildUrl(id, type, season || 1, episode || 1, imdbId),
  }));
}
