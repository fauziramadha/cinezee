// Helper untuk fetch API dengan Admin API Key

export async function adminFetch(url: string, options: RequestInit = {}, apiKey?: string) {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (apiKey) {
    headers["X-Admin-API-Key"] = apiKey;
  }
  return fetch(url, { ...options, headers });
}

export interface SubtitleEntry {
  id: number;
  title: string;
  type: string;
  season: string | null;
  episode: string | null;
  server: string | null;
  quality: string | null;
  release_name: string | null;
  offset_ms: number;
  updated_at: string;
}

// FIX C: Full subtitle with text (untuk edit mode)
export interface FullSubtitle extends SubtitleEntry {
  subtitle_text: string;
  language: string;
  created_at: string;
}

export async function fetchSubtitles(apiKey: string, search?: string): Promise<SubtitleEntry[]> {
  const url = search ? `/api/admin/subtitle?search=${encodeURIComponent(search)}` : "/api/admin/subtitle";
  const res = await adminFetch(url, {}, apiKey);
  if (!res.ok) return [];
  const data = await res.json();
  return data.subtitles || [];
}

// FIX C: Fetch single subtitle by ID (dengan text, untuk edit)
export async function fetchSubtitleById(apiKey: string, id: number): Promise<FullSubtitle | null> {
  const res = await adminFetch(`/api/admin/subtitle/${id}`, {}, apiKey);
  if (!res.ok) return null;
  const data = await res.json();
  return data.subtitle || null;
}

export async function deleteSubtitle(apiKey: string, id: number): Promise<boolean> {
  const res = await adminFetch(`/api/admin/subtitle/${id}`, { method: "DELETE" }, apiKey);
  return res.ok;
}

export async function saveSubtitle(apiKey: string, data: {
  title: string;
  type: "movie" | "tv";
  season?: string | null;
  episode?: string | null;
  server?: string | null;
  quality?: string | null;
  subtitle_text: string;
  release_name?: string | null;
  offset_seconds?: number;
}): Promise<{ ok: boolean; message?: string; error?: string }> {
  const res = await adminFetch("/api/admin/subtitle", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }, apiKey);
  const json = await res.json();
  return {
    ok: res.ok,
    message: json.message,
    error: json.error,
  };
}
