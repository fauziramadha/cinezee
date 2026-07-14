/**
 * src/lib/cinemacity-parser.ts
 *
 * Parser untuk HTML cinemacity.cc → JSON
 *
 * Changelog:
 *   - v2: parseMovieList pakai "nearest xfieldimage" approach (fix poster bleeds)
 *   - v3: extractStreamFromHtml support TV series nested folder structure
 *   - v4: Support multiple servers (Movie & TV Series)
 *         - Movie: [{title: "WEB-DL", file: "..."}, {title: "TS-CAM", file: "..."}]
 *         - TV: [{title: "Server 1", folder: [{title: "Season 1", folder: [...]}]}]
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

export interface CinemacityServer {
  title: string;
  streamUrl: string;
  subtitles?: CinemacitySubtitle[];
  // Untuk TV series dengan multiple servers: episodes per server
  episodes?: CinemacityStreamEpisode[];
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
  streamEpisodes?: CinemacityStreamEpisode[];
  servers?: CinemacityServer[];  // Multiple server options (Movie & TV)
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
// PARSER 1: HOMEPAGE / SEARCH → list film
// =====================================================
export function parseMovieList(html: string, baseUrl = "https://cinemacity.cc"): CinemacityMovie[] {
  const movies: CinemacityMovie[] = [];
  const seen = new Set<string>();

  // Find ALL xfieldimage images (poster + background)
  const imgPattern = /<img[^>]*class="[^"]*xfieldimage[^"]*"[^>]*src="([^"]+)"/gi;
  const images: Array<{ pos: number; src: string }> = [];
  let imgMatch;
  while ((imgMatch = imgPattern.exec(html)) !== null) {
    images.push({ pos: imgMatch.index, src: imgMatch[1] });
  }

  // Find all movie/TV links
  const linkPattern = /href="(?:https?:\/\/cinemacity\.cc)?\/(movies|tv-series)\/(\d+)-([^"\/]+?)\.html"/g;
  let match;

  while ((match = linkPattern.exec(html)) !== null) {
    const [fullMatch, typeRaw, id, slugPart] = match;
    const slug = `${id}-${slugPart}`;
    if (seen.has(slug)) continue;
    seen.add(slug);

    // Find nearest xfieldimage BEFORE this link
    let poster: string | undefined;
    for (let i = images.length - 1; i >= 0; i--) {
      if (images[i].pos < match.index!) {
        poster = images[i].src;
        break;
      }
    }

    if (poster) {
      poster = poster.startsWith("http")
        ? poster
        : baseUrl + (poster.startsWith("/") ? "" : "/") + poster;
    }

    // Extract TITLE from link text
    let title = slugPart.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const afterMatch = html.slice(match.index!).match(/^[^>]*>([^<]+)</);
    if (afterMatch && afterMatch[1]) {
      title = afterMatch[1].trim();
    }

    // Extract YEAR
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

  // Stream URL: cari eval(atob("..."))
  const streamInfo = extractStreamFromHtml(html);
  if (streamInfo) {
    detail.streamUrl = streamInfo.streamUrl;
    detail.qualities = streamInfo.qualities;
    detail.subtitles = streamInfo.subtitles;
    if (streamInfo.episodes) {
      detail.streamEpisodes = streamInfo.episodes;
    }
    if (streamInfo.servers) {
      detail.servers = streamInfo.servers;
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
// Support 4 struktur:
//   1. Movie single server:  [{ title: "WEB-DL", file: "..." }]
//   2. Movie multi servers:  [{ title: "TS-DKS", file: "..." }, { title: "CAM-Rip", file: "..." }]
//   3. TV single server:     [{ title: "Season 1", folder: [{ title: "Ep 1", file: "..." }] }]
//   4. TV multi servers:     [{ title: "Server 1", folder: [{ title: "Season 1", folder: [...] }] }]
export function extractStreamFromHtml(html: string): {
  streamUrl?: string;
  qualities?: string[];
  subtitles?: CinemacitySubtitle[];
  episodes?: CinemacityStreamEpisode[];
  servers?: CinemacityServer[];
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
        // Bisa single atau multiple servers
        // ============================================================
        if (firstSource.file && typeof firstSource.file === "string") {
          const streamUrl = firstSource.file as string;
          const qualities = extractQualities(streamUrl);
          const subtitles = parseSubtitles(firstSource.subtitle);

          // Detect multiple servers
          let servers: CinemacityServer[] = [];
          if (fileArray.length > 1) {
            for (const src of fileArray) {
              if (src.file && typeof src.file === "string") {
                servers.push({
                  title: src.title || `Server ${servers.length + 1}`,
                  streamUrl: src.file,
                  subtitles: parseSubtitles(src.subtitle),
                });
              }
            }
            console.log(`[PARSER] Movie has ${servers.length} servers:`,
              servers.map((s) => s.title).join(", "));
          }

          return {
            streamUrl,
            qualities,
            subtitles,
            servers: servers.length > 0 ? servers : undefined,
          };
        }

        // ============================================================
        // CASE 2: TV SERIES — nested folder structure
        // ============================================================
        if (firstSource.folder && Array.isArray(firstSource.folder)) {
          // Cek level 2: apakah ini TV multi-server atau TV single-server?
          const secondLevel = firstSource.folder[0];

          // ============================================================
          // CASE 2a: TV MULTI-SERVER — 3 levels nested
          // [{ title: "Server 1", folder: [{ title: "Season 1", folder: [{ title: "Ep 1", file: "..." }] }] }]
          // ============================================================
          if (secondLevel && secondLevel.folder && Array.isArray(secondLevel.folder)) {
            console.log("[PARSER] TV Series with multiple servers detected");
            const servers: CinemacityServer[] = [];

            for (const serverObj of fileArray) {
              const serverTitle = serverObj.title || `Server ${servers.length + 1}`;
              const serverEpisodes: CinemacityStreamEpisode[] = [];

              if (!serverObj.folder || !Array.isArray(serverObj.folder)) continue;

              for (const seasonObj of serverObj.folder) {
                const seasonTitle = seasonObj.title || "Season 1";
                const seasonMatch = seasonTitle.match(/Season\s*(\d+)/i);
                const seasonNum = seasonMatch ? seasonMatch[1] : undefined;

                if (!seasonObj.folder || !Array.isArray(seasonObj.folder)) continue;

                for (const epObj of seasonObj.folder) {
                  if (!epObj.file) continue;
                  const epTitle = epObj.title || "Episode";
                  const epMatch = epTitle.match(/Episode\s*(\d+)/i);
                  const epNum = epMatch ? epMatch[1] : undefined;

                  serverEpisodes.push({
                    title: epTitle,
                    streamUrl: epObj.file,
                    subtitles: parseSubtitles(epObj.subtitle),
                    season: seasonNum,
                    episode: epNum,
                  });
                }
              }

              servers.push({
                title: serverTitle,
                streamUrl: serverEpisodes[0]?.streamUrl || "",
                subtitles: serverEpisodes[0]?.subtitles,
                episodes: serverEpisodes,
              });
            }

            if (servers.length > 0) {
              const firstServer = servers[0];
              const firstEp = firstServer.episodes?.[0];
              const qualities = firstEp ? extractQualities(firstEp.streamUrl) : [];
              console.log(`[PARSER] TV has ${servers.length} servers, ${firstServer.episodes?.length || 0} episodes in server 1`);
              return {
                streamUrl: firstEp?.streamUrl,
                qualities,
                subtitles: firstEp?.subtitles,
                episodes: firstServer.episodes,
                servers,
              };
            }
          }

          // ============================================================
          // CASE 2b: TV SINGLE-SERVER — 2 levels nested
          // [{ title: "Season 1", folder: [{ title: "Ep 1", file: "..." }] }]
          // ============================================================
          console.log("[PARSER] TV Series single server detected");
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
// PARSER 4: EPISODES (HTML-based fallback)
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
