// ============================================================
// Types & Helpers for Detail Modal
// ============================================================

const VPS_API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "https://api.cinestream.my.id";

export { VPS_API_BASE };

// Helper: wrap cinemacity image URL ke image proxy
export function wrapImage(url: string | null | undefined): string {
  if (!url) return "/placeholder-poster.png";
  if (url.includes("cinemacity.cc")) {
    return `${VPS_API_BASE}/api/image?url=${encodeURIComponent(url)}`;
  }
  return url;
}

// ============================================================
// Types
// ============================================================
export interface VPSContent {
  id: number;
  cinemacity_id: string;
  slug: string;
  title: string;
  type: string;
  poster_url: string | null;
  description: string | null;
  rating: string | number | null;
  release_year: number | null;
  quality: string | null;
  stream_data: any[] | null;
  director: string | null;
  writer: string | null;
  stars: string | null;
  country: string | null;
  runtime: string | null;
  age_limit: string | null;
  trailer_url: string | null;
  recommendations: RecommendationItem[] | null;
  genres: string[] | string;
}

export interface RecommendationItem {
  cinemacity_id: string;
  slug: string;
  title: string;
  poster_url: string;
  rating: number;
  release_year: number;
  genre: string;
}

export interface Episode {
  season: number;
  episode: number;
  title: string;
}

export interface UserRating { id: string; rating: number; review: string | null; }
export interface RatingItem { id: string; rating: number; review: string | null; createdAt: string; userId: string; name: string | null; image: string | null; }
export interface CommentItem { id: string; userId: string; mediaId: number; mediaType: string; content: string; parentId: string | null; createdAt: string; updatedAt: string; userName: string | null; userImage: string | null; replies: CommentItem[]; }

// ============================================================
// Fetch VPS Content Detail
// ============================================================
export async function fetchVPSContent(
  cinemacityId: string,
  slug?: string,
  type?: string
): Promise<VPSContent | null> {
  try {
    const params = new URLSearchParams();
    if (slug) params.set('slug', slug);
    if (type) params.set('type', type);
    const query = params.toString();
    const url = `${VPS_API_BASE}/api/content/${cinemacityId}${query ? '?' + query : ''}`;
    const res = await fetch(url);
    const data = await res.json();
    return data.data || null;
  } catch (e) {
    console.error("[Detail] Fetch VPS error:", e);
    return null;
  }
}

// ============================================================
// Parse episodes from stream_data
// ============================================================
export function parseEpisodes(streamData: any[] | null): Episode[] {
  if (!streamData || !Array.isArray(streamData)) return [];
  const episodes: Episode[] = [];
  for (const season of streamData) {
    const seasonNum = parseInt(String(season.title || "").match(/\d+/)?.[0] || "1");
    if (season.folder && Array.isArray(season.folder)) {
      for (const ep of season.folder) {
        const epNum = parseInt(String(ep.title || "").match(/\d+/)?.[0] || "1");
        episodes.push({
          season: seasonNum,
          episode: epNum,
          title: ep.title || `Episode ${epNum}`,
        });
      }
    }
  }
  return episodes;
}

// ============================================================
// Extract YouTube video ID from URL
// ============================================================
export function getYouTubeId(url: string): string | null {
  if (!url) return null;
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
  return match ? match[1] : null;
}
