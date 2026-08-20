/**
 * src/lib/providers-dynamic.ts
 *
 * Wrapper untuk dynamic provider loading dari database.
 * Falls back ke hardcoded providers di src/lib/providers.ts
 * kalau database belum di-migrate atau error.
 *
 * Cara pakai di /api/providers/route.ts:
 *   import { getProvidersForMedia } from "@/lib/providers-dynamic";
 */

import { dbProvider, type ProviderConfig } from "@/lib/db-extended";

export interface RuntimeProvider {
  name: string;
  brutality: number;
  url: string;
  _config?: ProviderConfig;
}

/**
 * Ambil providers aktif dari database.
 * Return empty array kalau tabel belum ada (migration belum jalan).
 */
export async function getActiveProviders(): Promise<RuntimeProvider[]> {
  try {
    const configs = await dbProvider.listActive();

    if (configs.length === 0) {
      return [];
    }

    return configs.map((c) => ({
      name: c.server_label,
      brutality: c.brutality,
      url: "", // Akan diisi oleh buildProviderUrl
      _config: c,
    }));
  } catch (error) {
    console.error("[PROVIDERS DYNAMIC] Failed to load from DB:", error);
    return [];
  }
}

/**
 * Build URL untuk provider berdasarkan media type
 */
export function buildProviderUrl(
  provider: RuntimeProvider,
  mediaId: number | string,
  mediaType: "movie" | "tv",
  season?: number,
  episode?: number
): string {
  const cfg = provider._config;
  if (!cfg) {
    return provider.url;
  }

  let url = `${cfg.embed_base}/${mediaType === "movie" ? cfg.movie_path : cfg.tv_path}/${mediaId}`;
  if (mediaType === "tv") {
    url += `/${season || 1}/${episode || 1}`;
  }

  // Tambah query params (api_key, debug)
  const params: string[] = [];
  if (cfg.api_key && cfg.api_key_param) {
    params.push(`${cfg.api_key_param}=${encodeURIComponent(cfg.api_key)}`);
  }
  if (cfg.debug_param) {
    params.push(cfg.debug_param);
  }
  if (params.length > 0) {
    url += `?${params.join("&")}`;
  }

  return url;
}

/**
 * Helper untuk /api/providers route:
 * Returns array of { name, brutality, url } ready to use in iframe
 */
export async function getProvidersForMedia(
  mediaId: number | string,
  mediaType: "movie" | "tv",
  season?: number,
  episode?: number
): Promise<RuntimeProvider[]> {
  const providers = await getActiveProviders();

  return providers.map((p) => ({
    ...p,
    url: buildProviderUrl(p, mediaId, mediaType, season, episode),
  }));
}
