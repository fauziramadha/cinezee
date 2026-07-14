/**
 * src/lib/cinemacity-parser.ts
 *
 * Parser untuk HTML cinemacity.cc → JSON
 *
 * Changelog:
 *   - v2: parseMovieList pakai "nearest xfieldimage" approach (fix poster bleeds)
 *   - v3: extractStreamFromHtml support TV series nested folder structure
 *         { title: "Season 1", folder: [{ title: "Episode 1", file: "..." }] }
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
  streamEpisodes?: CinemacityStreamEpisode[];  // TV cinemacity (dengan stream URL per episode)
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

// Extended episode dengan stream URL (untuk TV series cinemacity)
export interface CinemacityStreamEpisode {
  title: string;
  streamUrl: string;
  subtitles?: CinemacitySubtitle[];
  season?: string;
  episode?: string;
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
// PARSER 1: HOMEPAGE / SEARCH → list film (IMPROVED v2)
// =====================================================
// Strategi: 
//   1. Cari SEMUA <img class="xfieldimage ..."> positions di HTML
//   2. Untuk setiap movie link, cari xfieldimage TERDEKAT sebelum link
//   3. Itu poster-nya film tersebut
//
// Kenapa: cinemacity punya 3 section types (dle-fast_item, dar-short_item, 
// dar-home_item) dengan class berbeda. Block-based approach gak reliable.
export function parseMovieList(html: string, baseUrl = "https://cinemacity.cc"): CinemacityMovie[] {
  const movies: CinemacityMovie[] = [];
  const seen = new Set<string>();

  // === Step 1: Find ALL xfieldimage images (poster + background) ===
  const imgPattern = /<img[^>]*class="[^"]*xfieldimage[^"]*"[^>]*src="([^"]+)"/gi;
  const images: Array<{ pos: number; src: string }> = [];
  let imgMatch;
  while ((imgMatch = imgPattern.exec(html)) !== null) {
    images.push({ pos: imgMatch.index, src: imgMatch[1] });
  }

  // === Step 2: Find all movie/TV links ===
  const linkPattern = /href="(?:https?:\/\/cinemacity\.cc)?\/(movies|tv-series)\/(\d+)-([^"\/]+?)\.html"/g;
  let match;

  while ((match = linkPattern.exec(html)) !== null) {
    const [fullMatch, typeRaw, id, slugPart] = match;
    const slug = `${id}-${slugPart}`;
    if (seen.has(slug)) continue;
    seen.add(slug);

    // === Step 3: Find nearest xfieldimage BEFORE this link ===
    let poster: string | undefined;
    for (let i = images.length - 1; i >= 0; i--) {
      if (images[i].pos < match.index!) {
        poster = images[i].src;
        break;
      }
    }

    // Normalize poster URL
    if (poster) {
      poster = poster.startsWith("http")
        ? poster
        : baseUrl + (poster.startsWith("/") ? "" : "/") + poster;
    }

    // === Step 4: Extract TITLE from link text ===
    let title = slugPart.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const afterMatch = html.slice(match.index!).match(/^[^>]*>([^<]+)</);
    if (afterMatch && afterMatch[1]) {
      title = afterMatch[1].trim();
    }

    // === Step 5: Extract YEAR ===
    let year: string | undefined;
    const yearFromTitle = title.match(/\((\d{4})\)/);
    if (yearFromTitle) {
      year = yearFromTitle[1];
    }
    if (!year) {
      const context = html.slice(match.index!, match.index! + 500);
      const yearFromMeta = context.match(/\/year\/(\d{4})\//);
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
    // TV series: simpan episode list dengan stream URLs
    if (streamInfo.episodes) {
      detail.streamEpisodes = streamInfo.episodes;
    }
  }

  if (detail.type === "tv") {
    detail.episodes = extractEpisodes(html);
  }

  return detail;
}

// =====================================================
// PARSER 3: EXTRACT STREAM URL DARI eval(atob)
// =====================================================
// Support 2 struktur:
//   1. Movie (flat): [{ title: "WEB-DL", file: "https://...", subtitle: "..." }]
//   2. TV Series (nested): [{ title: "Season 1", folder: [{ title: "Episode 1", file: "...", subtitle: "..." }] }]
export function extractStreamFromHtml(html: string): {
  streamUrl?: string;
  qualities?: string[];
  subtitles?: CinemacitySubtitle[];
  episodes?: CinemacityStreamEpisode[];
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
        if (!Array.isArray(fileArray) || fileArray.length === 0) continue;

        const firstSource = fileArray[0];

        // ============================================================
        // CASE 1: MOVIE — flat structure { title, file, subtitle }
        // ============================================================
        if (firstSource.file && typeof firstSource.file === "string") {
          const streamUrl = firstSource.file as string;
          const qualities = extractQualities(streamUrl);
          const subtitles = parseSubtitles(firstSource.subtitle);
          return { streamUrl, qualities, subtitles };
        }

        // ============================================================
        // CASE 2: TV SERIES — nested { title: "Season X", folder: [...] }
        // ============================================================
        if (firstSource.folder && Array.isArray(firstSource.folder)) {
          const episodes: CinemacityStreamEpisode[] = [];

          for (const seasonObj of fileArray) {
            const seasonTitle = seasonObj.title || "Season 1";
            const seasonMatch = seasonTitle.match(/Season\s*(\d+)/i);
            const seasonNum = seasonMatch ? seasonMatch[1] : undefined;

            if (!seasonObj.folder || !Array.isArray(seasonObj.folder)) continue;

            for (const epObj of seasonObj.folder) {
              if (!epObj.file) continue;
              const epTitle = epObj.title || "Episode";
              const epMatch = epTitle.match(/Episode\s*(\d+)/i);
              const epNum = epMatch ? epMatch[1] : undefined;

              episodes.push({
                title: epTitle,
                streamUrl: epObj.file,
                subtitles: parseSubtitles(epObj.subtitle),
                season: seasonNum,
                episode: epNum,
              });
            }
          }

          if (episodes.length > 0) {
            // Return episode pertama sebagai default stream
            const firstEp = episodes[0];
            const qualities = extractQualities(firstEp.streamUrl);
            return {
              streamUrl: firstEp.streamUrl,
              qualities,
              subtitles: firstEp.subtitles,
              episodes,
            };
          }
        }
      } catch (e) {
        console.error("[PLAYERJS JSON PARSE ERROR]", e);
      }
    }
  }

  return null;
}

// =====================================================
// HELPER: Extract qualities dari stream URL
// =====================================================
function extractQualities(streamUrl: string): string[] {
  const qualities: string[] = [];
  const qualityPattern = /(\d{3,4}p)/g;
  let qMatch;
  while ((qMatch = qualityPattern.exec(streamUrl)) !== null) {
    if (!qualities.includes(qMatch[1])) {
      qualities.push(qMatch[1]);
    }
  }
  return qualities;
}

// =====================================================
// HELPER: Parse subtitles dari Playerjs format
// =====================================================
// Format: "[English (Full)]https://...,[SDH English]https://..."
function parseSubtitles(subtitleField: string | undefined): CinemacitySubtitle[] {
  const subtitles: CinemacitySubtitle[] = [];
  if (!subtitleField) return subtitles;

  const subPattern = /\[([^\]]+)\](https?:\/\/[^\s,\]]+)/g;
  let subMatch;
  while ((subMatch = subPattern.exec(subtitleField)) !== null) {
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
  return subtitles;
}

// =====================================================
// PARSER 4: EPISODES (untuk TV series — HTML-based, fallback)
// =====================================================
// Note: cinemacity TV series pakai Playerjs folder structure (bukan HTML links),
// jadi function ini biasanya return empty array. Stream episodes ada di
// detail.streamEpisodes (dari extractStreamFromHtml).
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
