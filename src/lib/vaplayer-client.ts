export interface VaplayerStreamUrl {
  url: string;
  label: string;
  hostname: string;
}

export interface VaplayerStreamResponse {
  title: string;
  imdb_id: string;
  file_name: string;
  backdrop: string;
  stream_urls: VaplayerStreamUrl[];
  default_subs: any[];
  thumbnails_url: string;
  season?: string;
  episode?: string;
}

// ============================================================
// PROXY WRAPPER (untuk Safari/iPhone native HLS player)
// Pakai URL-encoded supaya konsisten dengan proxy route
// ============================================================
const VAPLAYER_DOMAINS = [
  "onlinevisibilitysystem.site",
  "quietmidnightgardeningideas.site",
  "app.putgate.com",
  "vidapi.cloud",
];

export function wrapWithProxy(url: string): string {
  if (!url) return url;
  // Kalau URL mengandung domain vaplayer, rewrite ke proxy
  const isVaplayer = VAPLAYER_DOMAINS.some(d => url.includes(d));
  if (!isVaplayer) return url;
  // URL-encode supaya aman di query string
  return `/api/vaplayer/proxy?u=${encodeURIComponent(url)}`;
}

// Helper: extract URL asli dari proxy URL
export function getOriginalUrl(url: string): string {
  if (url.startsWith("/api/vaplayer/proxy?u=")) {
    try {
      const params = new URLSearchParams(url.split("?")[1]);
      return params.get("u") || url;
    } catch {
      return url;
    }
  }
  return url;
}

// Helper: wrap array of stream URLs dengan proxy
export function wrapStreamUrlsWithProxy(urls: VaplayerStreamUrl[]): VaplayerStreamUrl[] {
  return urls.map(u => ({
    ...u,
    url: wrapWithProxy(u.url),
  }));
}

export async function fetchVaplayerStream(
  imdb: string,
  type: 'movie' | 'tv' = 'movie',
  season?: string | number,
  episode?: string | number,
): Promise<VaplayerStreamResponse> {
  const params = new URLSearchParams({ imdb, type });
  if (type === 'tv') {
    params.set('season',  String(season));
    params.set('episode', String(episode));
  }

  const url = `/api/vaplayer/stream?${params.toString()}`;
  const resp = await fetch(url);

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err?.error || `HTTP ${resp.status}`);
  }

  const raw = await resp.json();

  const rawUrls: string[] = raw?.data?.stream_urls || [];
  const stream_urls: VaplayerStreamUrl[] = rawUrls.map((u, i) => {
    let hostname = 'unknown';
    try { hostname = new URL(u).hostname; } catch {}
    let label = `Server ${i + 1}`;
    if (hostname.includes('putgate'))     label = `Server ${i + 1} (Mirror)`;
    else if (hostname.includes('onlinevisibility')) label = `Server ${i + 1} (HD)`;
    else if (hostname.includes('quietmidnight'))    label = `Server ${i + 1} (HD)`;
    return { url: u, label, hostname };
  });

  return {
    title:          raw.data.title || '',
    imdb_id:        raw.data.imdb_id || imdb,
    file_name:      raw.data.file_name || '',
    backdrop:       raw.data.backdrop || '',
    stream_urls,
    default_subs:   raw.data.default_subs || [],
    thumbnails_url: raw.data.thumbnails_url || '',
    season:         raw.data.season,
    episode:        raw.data.episode,
  };
}
