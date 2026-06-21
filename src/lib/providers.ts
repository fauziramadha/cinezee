/**
 * Multi-provider streaming configuration
 * Based on investigation of 9 providers (Vidking, VidLink, Videasy, VidFast, etc.)
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

/**
 * Provider priority list (sorted by brutality, lowest first)
 *
 * Based on real-world testing:
 * - Vidking: 0 ads (verified)
 * - VidLink: 1 ad (pre-roll, verified)
 * - MultiEmbed: 1-2 ads (community-verified)
 * - VidFast: 1-3 ads (verified, click popunder)
 * - VidSrc-embed.ru: 3 ads (verified)
 * - Vidrock: 6 ads (verified, last resort)
 */
export const PROVIDERS: Provider[] = [
  {
    name: "Vidking",
    baseUrl: "https://www.vidking.net/embed",
    brutality: 0,
    supportsSandbox: false,
    buildUrl: (id, type, season, episode) =>
      type === "movie"
        ? `https://www.vidking.net/embed/movie/${id}`
        : `https://www.vidking.net/embed/tv/${id}/${season}/${episode}`,
  },
  {
    name: "VidLink",
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
  {
    name: "MultiEmbed",
    baseUrl: "https://multiembed.mov",
    brutality: 2,
    supportsSandbox: false,
    buildUrl: (id, type, season, episode) =>
      type === "movie"
        ? `https://multiembed.mov/?video_id=${id}&tmdb=1`
        : `https://multiembed.mov/?video_id=${id}&tmdb=1&s=${season}&e=${episode}`,
  },
  {
    name: "VidFast",
    baseUrl: "https://vidfast.pro",
    brutality: 4,
    supportsSandbox: false,
    buildUrl: (id, type, season, episode) =>
      type === "movie"
        ? `https://vidfast.pro/movie/${id}?theme=B20710&autoPlay=false&poster=true&title=true`
        : `https://vidfast.pro/tv/${id}/${season}/${episode}?theme=B20710&autoPlay=false&nextButton=true&poster=true&title=true`,
  },
  {
    name: "VidSrc",
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
  {
    name: "Vidrock",
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
