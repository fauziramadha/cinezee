/**
 * CineStream - Vaplayer Stream Client Helper
 * -------------------------------------------------------
 * Helper untuk panggil /api/vaplayer/stream dan normalisasi response
 * agar gampang dipakai di player-modal.tsx
 */

export interface VaplayerStreamUrl {
  url: string;
  label: string;       // "Server 1", "Server 2", dst
  hostname: string;    // "onlinevisibilitysystem.site" / "app.putgate.com"
}

export interface VaplayerStreamResponse {
  title: string;
  imdb_id: string;
  file_name: string;
  backdrop: string;
  stream_urls: VaplayerStreamUrl[];
  default_subs: any[];
  thumbnails_url: string;
  // TV-only
  season?: string;
  episode?: string;
}

/**
 * Fetch stream URLs dari vaplayer.ru via Worker proxy
 *
 * @param imdb    - IMDB ID, contoh: "tt1375666"
 * @param type    - "movie" | "tv"
 * @param season  - wajib jika type=tv, contoh: "1"
 * @param episode - wajib jika type=tv, contoh: "1"
 */
export async function fetchVaplayerStream(
  imdb: string,
  type: 'movie' | 'tv' = 'movie',
  season?: string | number,
  episode?: string | number,
): Promise<VaplayerStreamResponse> {
  const params = new URLSearchParams({
    imdb: imdb,
    type: type,
  });
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

  // Normalize: ubah array of string jadi array of object dengan label
  const rawUrls: string[] = raw?.data?.stream_urls || [];
  const stream_urls: VaplayerStreamUrl[] = rawUrls.map((u, i) => {
    let hostname = 'unknown';
    try {
      hostname = new URL(u).hostname;
    } catch {}

    // Label berdasarkan hostname pattern
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

/**
 * Helper untuk cek apakah stream URL accessible (HEAD request)
 * Returns true kalau URL bisa diakses
 */
export async function checkStreamAccessible(streamUrl: string): Promise<boolean> {
  try {
    const resp = await fetch(streamUrl, {
      method: 'HEAD',
      mode: 'no-cors',  // Hindari CORS issue di browser
    });
    return resp.ok || resp.type === 'opaque';
  } catch {
    return false;
  }
}

/**
 * Pilih stream URL terbaik berdasarkan kriteria:
 * 1. Skip putgate.com (biasanya paling lambat)
 * 2. Pilih yang pertama accessible
 */
export async function pickBestStream(
  urls: VaplayerStreamUrl[],
): Promise<VaplayerStreamUrl | null> {
  // Prioritas: onlinevisibility dulu, putgate terakhir
  const sorted = [...urls].sort((a, b) => {
    const aPut = a.hostname.includes('putgate') ? 1 : 0;
    const bPut = b.hostname.includes('putgate') ? 1 : 0;
    return aPut - bPut;
  });

  for (const u of sorted) {
    const ok = await checkStreamAccessible(u.url);
    if (ok) return u;
  }

  // Fallback: return yang pertama kalau semua HEAD gagal (mungkin karena CORS)
  return sorted[0] || null;
}
