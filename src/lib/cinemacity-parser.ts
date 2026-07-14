/**
 * src/lib/cinemacity-parser.ts
 *
 * Parser untuk HTML cinemacity.cc → JSON
 */

export interface CinemacityMovie {
  id: string;
  slug: string;
  type: "movie" | "tv";
  title: string;
  url: string;
  poster?: string;
  year?: string;
}

export interface CinemacityDetail {
  id: string;
  slug: string;
  type: "movie" | "tv";
  title: string;
  url: string;
  poster?: string;
  backdrop?: string;
  description?: string;
  genres?: string[];
  year?: string;
  rating?: string;
  cast?: string[];
  directors?: string[];
  streamUrl?: string;
  qualities?: string[];
  subtitles?: CinemacitySubtitle[];
  episodes?: CinemacityEpisode[];
  seasons?: number;
}

export interface CinemacitySubtitle {
  label: string;
  url: string;
  language: string;
  type: "full" | "sdh" | "forced";
}

export interface CinemacityEpisode {
  id: string;
  title: string;
  url: string;
  season?: number;
  episode?: number;
}

function decodeBase64(b64: string): string {
  try {
    if (typeof atob === "function") return atob(b64);
    if (typeof Buffer !== "undefined") return Buffer.from(b64, "base64").toString("utf-8");
    return b64;
  } catch (e) {
    console.error("[BASE64 DECODE ERROR]", e);
    return "";
  }
}

function unescapeJsString(s: string): string {
  return s
    .replace(/\\\//g, "/")
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'");
}

export function parseSlugFromUrl(url: string): {
  id: string;
  slug: string;
  type: "movie" | "tv";
} | null {
  const match = url.match(/\/(movies|tv-series)\/(\d+)-([^/]+?)\.html/);
  if (!match) return null;
  return {
    type: match[1] === "movies" ? "movie" : "tv",
    id: match[2],
    slug: `${match[2]}-${match[3]}`,
  };
}

// =====================================================
// PARSER 1: HOMEPAGE / SEARCH → list film (IMPROVED)
// =====================================================
export function parseMovieList(html: string, baseUrl = "https://cinemacity.cc"): CinemacityMovie[] {
  const movies: CinemacityMovie[] = [];
  const seen = new Set<string>();

  // Find all movie/TV links
  const linkPattern = /href="(?:https?:\/\/cinemacity\.cc)?\/(movies|tv-series)\/(\d+)-([^"\/]+?)\.html"/g;
  let match;

  while ((match = linkPattern.exec(html)) !== null) {
    const [fullMatch, typeRaw, id, slugPart] = match;
    const slug = `${id}-${slugPart}`;
    if (seen.has(slug)) continue;
    seen.add(slug);

    // Find the enclosing dar-short_item block (search backwards)
    const blockStart = html.lastIndexOf('dar-short_item', match.index!);
    const nextBlockStart = html.indexOf('dar-short_item', match.index! + 1);
    const block = (blockStart !== -1 && nextBlockStart !== -1)
      ? html.slice(blockStart, nextBlockStart)
      : html.slice(Math.max(0, match.index! - 1000), Math.min(html.length, match.index! + 500));

    // === Extract POSTER (priority order) ===
    let poster: string | undefined;

    // Priority 1: <img class="xfieldimage poster" src="...">
    const posterImgMatch = block.match(/<img[^>]*class="[^"]*xfieldimage\s+poster[^"]*"[^>]*src="([^"]+)"/i);
    if (posterImgMatch) {
      poster = posterImgMatch[1];
    }

    // Priority 2: any src containing /uploads/posts/ with image extension
    if (!poster) {
      const uploadsMatch = block.match(/src="([^"]*\/uploads\/posts\/[^"]+\.(?:webp|jpg|jpeg|png))/i);
      if (uploadsMatch) {
        poster = uploadsMatch[1];
      }
    }

    // Priority 3: any src with image extension (fallback)
    if (!poster) {
      const anyImgMatch = block.match(/src="([^"]+\.(?:webp|jpg|jpeg|png))/i);
      if (anyImgMatch) {
        // Skip non-poster images (avatars, icons, etc)
        const url = anyImgMatch[1];
        if (!url.includes('noavatar') && !url.includes('templates/') && !url.includes('logo')) {
          poster = url;
        }
      }
    }

    // Normalize poster URL (relative → absolute)
    if (poster) {
      poster = poster.startsWith("http")
        ? poster
        : baseUrl + (poster.startsWith("/") ? "" : "/") + poster;
    }

    // === Extract TITLE from link text ===
    // Pattern: <a href=".../movies/2406-lockbox.html" class="e-nowrap">Winthrop / Lockbox (2026)</a>
    let title = slugPart.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const titleFromLink = fullMatch ? html.slice(match.index!).match(/^[^>]*>([^<]+)</) : null;
    if (titleFromLink && titleFromLink[1]) {
      title = titleFromLink[1].trim();
    }

    // === Extract YEAR ===
    let year: string | undefined;
    // From title parentheses: "Winthrop / Lockbox (2026)" → 2026
    const yearFromTitle = title.match(/\((\d{4})\)/);
    if (yearFromTitle) {
      year = yearFromTitle[1];
    }
    // From meta: <a href=".../year/2026/">2026</a>
    if (!year) {
      const yearFromMeta = block.match(/\/year\/(\d{4})\//);
      if (yearFromMeta) {
        year = yearFromMeta[1];
      }
    }

    // Clean title (remove year suffix)
    const cleanTitle = title.replace(/\s*\(\d{4}.*?\)\s*$/, "").trim();

    movies.push({
      id,
      slug,
      type: typeRaw === "movies" ? "movie" : "tv",
      title: cleanTitle,
      url: `${baseUrl}/${typeRaw}/${slug}.html`,
      poster,
      year,
    });
  }

  return movies;
}

// =====================================================
// PARSER 2: DETAIL PAGE → metadata + stream URL
// =====================================================
export function parseDetailPage(html: string, url: string): CinemacityDetail {
  const slugInfo = parseSlugFromUrl(url);

  const detail: CinemacityDetail = {
    id: slugInfo?.id || "",
    slug: slugInfo?.slug || "",
    type: slugInfo?.type || "movie",
    title: "",
    url,
  };

  // Title dari <title> tag
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch) {
    detail.title = titleMatch[1].split("»")[0].trim();
  }

  // Description dari meta
  const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i);
  if (descMatch) {
    detail.description = descMatch[1];
  }

  // Poster/backdrop dari og:image
  const ogImageMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
  if (ogImageMatch) {
    detail.backdrop = ogImageMatch[1];
    detail.poster = ogImageMatch[1];
  }

  // Year dari title
  const yearMatch = detail.title.match(/\((\d{4})/);
  if (yearMatch) {
    detail.year = yearMatch[1];
    detail.title = detail.title.replace(/\s*\(\d{4}.*?\)\s*$/, "").trim();
  }

  // Genres dari keywords meta
  const keywordsMatch = html.match(/<meta\s+name="keywords"\s+content="([^"]+)"/i);
  if (keywordsMatch) {
    detail.genres = keywordsMatch[1].split(",").map((g) => g.trim()).filter(Boolean);
  }

  // Stream URL: cari eval(atob("..."))
  const streamInfo = extractStreamFromHtml(html);
  if (streamInfo) {
    detail.streamUrl = streamInfo.streamUrl;
    detail.qualities = streamInfo.qualities;
    detail.subtitles = streamInfo.subtitles;
  }

  if (detail.type === "tv") {
    detail.episodes = extractEpisodes(html);
  }

  return detail;
}

// =====================================================
// PARSER 3: EXTRACT STREAM URL DARI eval(atob)
// =====================================================
export function extractStreamFromHtml(html: string): {
  streamUrl?: string;
  qualities?: string[];
  subtitles?: CinemacitySubtitle[];
} | null {
  const atobPattern = /atob\("([^"]+)"\)/g;
  const matches = [...html.matchAll(atobPattern)];

  for (const match of matches) {
    const b64 = match[1];
    const decoded = decodeBase64(b64);

    const playerjsMatch = decoded.match(
      /new\s+Playerjs\s*\(\s*\{[\s\S]*?file\s*:\s*'(\[[\s\S]*?\])'/
    );

    if (playerjsMatch) {
      const fileJsonRaw = playerjsMatch[1];
      const fileJson = unescapeJsString(fileJsonRaw);

      try {
        const fileArray = JSON.parse(fileJson);
        if (Array.isArray(fileArray) && fileArray.length > 0) {
          const firstSource = fileArray[0];
          const streamUrl = firstSource.file as string;

          const qualities: string[] = [];
          const qualityPattern = /(\d{3,4}p)/g;
          let qMatch;
          while ((qMatch = qualityPattern.exec(streamUrl)) !== null) {
            if (!qualities.includes(qMatch[1])) {
              qualities.push(qMatch[1]);
            }
          }

          const subtitles: CinemacitySubtitle[] = [];
          if (firstSource.subtitle) {
            const subPattern = /\[([^\]]+)\](https?:\/\/[^\s,\]]+)/g;
            let subMatch;
            while ((subMatch = subPattern.exec(firstSource.subtitle)) !== null) {
              const label = subMatch[1];
              const subUrl = subMatch[2];
              const langMatch = label.match(/([A-Za-z]+)/);
              const typeMatch = label.toLowerCase().match(/(full|sdh|forced)/);

              subtitles.push({
                label,
                url: subUrl,
                language: langMatch?.[1].toLowerCase() || "unknown",
                type: (typeMatch?.[1] as "full" | "sdh" | "forced") || "full",
              });
            }
          }

          return { streamUrl, qualities, subtitles };
        }
      } catch (e) {
        console.error("[PLAYERJS JSON PARSE ERROR]", e);
      }
    }
  }

  return null;
}

// =====================================================
// PARSER 4: EPISODES (untuk TV series)
// =====================================================
function extractEpisodes(html: string): CinemacityEpisode[] {
  const episodes: CinemacityEpisode[] = [];
  const seen = new Set<string>();

  const patterns = [
    /\/tv-series\/(\d+)-([^"\/]+?)-season-(\d+)-episode-(\d+)\.html/g,
    /\/tv-series\/(\d+)-([^"\/]+?)-s(\d+)e(\d+)\.html/gi,
    /\/tv-series\/(\d+)-([^"\/]+?)-(\d+)-(\d+)\.html/g,
  ];

  for (const pattern of patterns) {
    const matches = [...html.matchAll(pattern)];
    for (const match of matches) {
      const [full, id, slug, season, episode] = match;
      if (seen.has(full)) continue;
      seen.add(full);

      episodes.push({
        id: `${id}-s${season}e${episode}`,
        title: `S${season}E${episode}`,
        url: `https://cinemacity.cc${full}`,
        season: Number(season),
        episode: Number(episode),
      });
    }
    if (episodes.length > 0) break;
  }

  return episodes;
}
