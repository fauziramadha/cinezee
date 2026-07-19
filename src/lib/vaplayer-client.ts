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
