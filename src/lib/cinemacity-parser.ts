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

export function parseMovieList(html: string, baseUrl = "https://cinemacity.cc"): CinemacityMovie[] {
  const movies: CinemacityMovie[] = [];
  const seen = new Set<string>();

  const linkPattern = /href="(?:https?:\/\/cinemacity\.cc)?\/(movies|tv-series)\/(\d+)-([^"\/]+?)\.html"/g;
  let match;

  while ((match = linkPattern.exec(html)) !== null) {
    const [_, typeRaw, id, slugPart] = match;
    const slug = `${id}-${slugPart}`;
    if (seen.has(slug)) continue;
    seen.add(slug);

    const start = Math.max(0, match.index! - 200);
    const end = Math.min(html.length, match.index! + 500);
    const context = html.slice(start, end);

    let title = slugPart.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

    const altMatch = context.match(/alt="([^"]+)"/);
    if (altMatch && altMatch[1] && !altMatch[1].toLowerCase().includes("cinemacity")) {
      title = altMatch[1];
    }

    const titleAttrMatch = context.match(/title="([^"]+)"/);
    if (titleAttrMatch && titleAttrMatch[1] && !titleAttrMatch[1].toLowerCase().includes("cinemacity")) {
      title = titleAttrMatch[1];
    }

    let poster: string | undefined;
    const posterMatch = context.match(/src="([^"]+\.(?:jpg|jpeg|webp|png)[^"]*)"/i);
    if (posterMatch) {
      poster = posterMatch[1].startsWith("http")
        ? posterMatch[1]
        : baseUrl + (posterMatch[1].startsWith("/") ? "" : "/") + posterMatch[1];
    }

    const yearMatch = title.match(/\((\d{4})\)/);
    const year = yearMatch?.[1];

    movies.push({
      id,
      slug,
      type: typeRaw === "movies" ? "movie" : "tv",
      title: title.replace(/\s*\(\d{4}\)\s*$/, "").trim(),
      url: `${baseUrl}/${typeRaw}/${slug}.html`,
      poster,
      year,
    });
  }

  return movies;
}

export function parseDetailPage(html: string, url: string): CinemacityDetail {
  const slugInfo = parseSlugFromUrl(url);

  const detail: CinemacityDetail = {
    id: slugInfo?.id || "",
    slug: slugInfo?.slug || "",
    type: slugInfo?.type || "movie",
    title: "",
    url,
  };

  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch) {
    detail.title = titleMatch[1].split("»")[0].trim();
  }

  const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i);
  if (descMatch) {
    detail.description = descMatch[1];
  }

  const ogImageMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
  if (ogImageMatch) {
    detail.backdrop = ogImageMatch[1];
    detail.poster = ogImageMatch[1];
  }

  const yearMatch = detail.title.match(/\((\d{4})/);
  if (yearMatch) {
    detail.year = yearMatch[1];
    detail.title = detail.title.replace(/\s*\(\d{4}.*?\)\s*$/, "").trim();
  }

  const keywordsMatch = html.match(/<meta\s+name="keywords"\s+content="([^"]+)"/i);
  if (keywordsMatch) {
    detail.genres = keywordsMatch[1].split(",").map((g) => g.trim()).filter(Boolean);
  }

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
