"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Trash2, Upload, FileText, Search, X,
} from "lucide-react";

interface SubtitleEntry {
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

interface SearchResult {
  id: string;
  slug: string;
  type: string;
  title: string;
  poster?: string;
  year?: string;
}

interface ServerOption {
  title: string;
  streamUrl: string;
}
interface Episode {
  title: string;
  streamUrl: string;
  season?: string;
  episode?: string;
}

export default function AdminSubtitlePage() {
  const [entries, setEntries] = useState<SubtitleEntry[]>([]);
  const [entriesSearch, setEntriesSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"movie" | "tv">("movie");
  const [season, setSeason] = useState("");
  const [episode, setEpisode] = useState("");
  const [server, setServer] = useState("");
  const [quality, setQuality] = useState("");
  const [subtitleText, setSubtitleText] = useState("");
  const [releaseName, setReleaseName] = useState("");
  const [offsetSeconds, setOffsetSeconds] = useState("");

  // Search state (find film)
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<SearchResult | null>(null);

  // TV episodes + servers state
  const [seasons, setSeasons] = useState<string[]>([]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [servers, setServers] = useState<ServerOption[]>([]);

  const [apiKey, setApiKey] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("admin_api_key");
    if (saved) setApiKey(saved);
  }, []);

  useEffect(() => {
    if (apiKey) {
      localStorage.setItem("admin_api_key", apiKey);
      fetchEntries();
    }
  }, [apiKey]);

  // Refetch entries saat entriesSearch berubah
  useEffect(() => {
    if (apiKey) fetchEntries();
  }, [entriesSearch]);

  // Search cinemacity (debounce)
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/cinemacity/search?q=${encodeURIComponent(searchQuery)}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.movies || []);
        }
      } catch {} finally {
        setSearchLoading(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelectMedia = async (media: SearchResult) => {
    setSelectedMedia(media);
    setTitle(media.title);
    setType(media.type as "movie" | "tv");
    setSearchQuery("");
    setSearchResults([]);
    setSeason("");
    setEpisode("");
    setServer("");
    setSeasons([]);
    setEpisodes([]);
    setServers([]);

    try {
      const res = await fetch(`/api/cinemacity/movie/${media.slug}`);
      if (res.ok) {
        const data = await res.json();
        const movie = data.movie || {};
        // Episodes (TV)
        const eps = movie.streamEpisodes || [];
        setEpisodes(eps);
        const seasonSet = new Set<string>();
        eps.forEach((e: Episode) => seasonSet.add(e.season || "1"));
        setSeasons(Array.from(seasonSet).sort((a, b) => Number(a) - Number(b)));
        // Servers
        const srvs = movie.servers || [];
        setServers(srvs);
      }
    } catch {}
  };

  const currentSeasonEpisodes = episodes.filter((e) => (e.season || "1") === season);

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const url = entriesSearch
        ? `/api/admin/subtitle?search=${encodeURIComponent(entriesSearch)}`
        : "/api/admin/subtitle";
      const res = await fetch(url, {
        headers: { "X-Admin-API-Key": apiKey },
      });
      if (res.ok) {
        const data = await res.json();
        setEntries(data.subtitles || []);
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !subtitleText.trim()) {
      setError("Title and Subtitle Text are required");
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/admin/subtitle", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-API-Key": apiKey,
        },
        body: JSON.stringify({
          title: title.trim(), type, season: season || null, episode: episode || null,
          server: server || null, quality: quality || null,
          subtitle_text: subtitleText, release_name: releaseName || null,
          offset_seconds: offsetSeconds || 0,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSuccess(data.message || "Subtitle saved");
        setTitle(""); setSeason(""); setEpisode(""); setServer("");
        setQuality(""); setSubtitleText(""); setReleaseName(""); setOffsetSeconds("");
        setSelectedMedia(null); setSeasons([]); setEpisodes([]); setServers([]);
        fetchEntries();
      } else {
        const err = await res.json();
        setError(err.error || "Failed to save");
      }
    } catch { setError("Network error"); } finally { setSubmitting(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this subtitle?")) return;
    try {
      const res = await fetch(`/api/admin/subtitle/${id}`, {
        method: "DELETE",
        headers: { "X-Admin-API-Key": apiKey },
      });
      if (res.ok) fetchEntries();
    } catch {}
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text.includes("%PDF") || text.includes("\u0000")) {
        setError("File bukan subtitle text. Upload .srt atau .vtt.");
        e.target.value = "";
        return;
      }
      if (!text.match(/\d{2}:\d{2}:\d{2}/)) {
        setError("File gak terlihat sebagai SRT/VTT valid.");
      } else { setError(null); }
      setSubtitleText(text);
      if (!releaseName) setReleaseName(file.name.replace(/\.(srt|vtt|txt)$/i, ""));
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Subtitle Manager</h1>
          <p className="text-sm text-muted-foreground">
            Upload subtitle Indonesia manual (no expiry, replace kapan saja)
          </p>
        </div>

        {!apiKey && (
          <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4">
            <Label className="text-sm font-semibold">Admin API Key</Label>
            <Input
              type="password"
              placeholder="Paste your ADMIN_API_KEY"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="mt-1"
            />
          </div>
        )}

        {apiKey && (
          <>
            {/* SEARCH FILM */}
            <div className="space-y-3 rounded-lg border bg-card p-4">
              <h2 className="text-lg font-semibold">1. Cari Film / TV Series</h2>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Ketik judul film..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
                {searchLoading && (
                  <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin" />
                )}
              </div>

              {searchResults.length > 0 && (
                <div className="max-h-80 space-y-1 overflow-y-auto rounded-md border bg-background p-2">
                  {searchResults.map((media) => (
                    <button
                      key={media.slug}
                      onClick={() => handleSelectMedia(media)}
                      className="flex w-full items-center gap-3 rounded-md p-2 text-left hover:bg-muted"
                    >
                      {media.poster ? (
                        <img
                          src={media.poster.includes("cinemacity.cc")
                            ? `/api/cinemacity/image?url=${encodeURIComponent(media.poster)}`
                            : media.poster}
                          alt={media.title}
                          className="h-14 w-10 shrink-0 rounded object-cover"
                        />
                      ) : (
                        <div className="flex h-14 w-10 shrink-0 items-center justify-center rounded bg-muted">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{media.title}</p>
                        <div className="mt-0.5 flex items-center gap-1">
                          <Badge variant="secondary" className="text-[10px]">
                            {media.type === "tv" ? "TV" : "Movie"}
                          </Badge>
                          {media.year && (
                            <span className="text-[10px] text-muted-foreground">{media.year}</span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {selectedMedia && (
                <div className="flex items-center gap-2 rounded-md bg-primary/10 p-2">
                  <Badge variant="secondary" className="text-[10px]">
                    {selectedMedia.type === "tv" ? "TV Series" : "Movie"}
                  </Badge>
                  <span className="flex-1 truncate text-sm font-medium">{selectedMedia.title}</span>
                  <button
                    onClick={() => {
                      setSelectedMedia(null); setTitle(""); setSeason(""); setEpisode("");
                      setServer(""); setSeasons([]); setEpisodes([]); setServers([]);
                    }}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            {/* UPLOAD FORM */}
            <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border bg-card p-4">
              <h2 className="text-lg font-semibold">2. Upload Subtitle</h2>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="title">Title *</Label>
                  <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Cari film di atas dulu..." required />
                </div>
                <div>
                  <Label htmlFor="type">Type</Label>
                  <select id="type" value={type} onChange={(e) => setType(e.target.value as "movie" | "tv")}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="movie">Movie</option>
                    <option value="tv">TV Series</option>
                  </select>
                </div>
              </div>

              {/* SERVER SELECTOR — hanya kalau film punya multiple servers */}
              {servers.length > 1 && (
                <div className="rounded-md border border-purple-500/30 bg-purple-500/5 p-3">
                  <Label htmlFor="serverSelect">Server (pilih untuk subtitle spesifik)</Label>
                  <select
                    id="serverSelect"
                    value={server}
                    onChange={(e) => setServer(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">All servers (generic subtitle)</option>
                    {servers.map((srv, idx) => (
                      <option key={idx} value={srv.title}>{srv.title}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Pilih server spesifik kalau subtitle cuma sync untuk server itu. Biarkan "All servers" kalau subtitle sync untuk semua.
                  </p>
                </div>
              )}

              {/* TV: Season & Episode */}
              {type === "tv" && seasons.length > 0 && (
                <div className="grid grid-cols-2 gap-3 rounded-md border border-blue-500/30 bg-blue-500/5 p-3">
                  <div>
                    <Label htmlFor="seasonSelect">Season</Label>
                    <select id="seasonSelect" value={season}
                      onChange={(e) => { setSeason(e.target.value); setEpisode(""); }}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                      <option value="">Pilih Season...</option>
                      {seasons.map((s) => <option key={s} value={s}>Season {s}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="episodeSelect">Episode</Label>
                    <select id="episodeSelect" value={episode}
                      onChange={(e) => setEpisode(e.target.value)} disabled={!season}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50">
                      <option value="">Pilih Episode...</option>
                      {currentSeasonEpisodes.map((ep, idx) => (
                        <option key={idx} value={ep.episode || String(idx + 1)}>
                          E{ep.episode || idx + 1} — {ep.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {seasons.length === 0 && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div>
                    <Label htmlFor="season">Season</Label>
                    <Input id="season" value={season} onChange={(e) => setSeason(e.target.value)} placeholder="1" />
                  </div>
                  <div>
                    <Label htmlFor="episode">Episode</Label>
                    <Input id="episode" value={episode} onChange={(e) => setEpisode(e.target.value)} placeholder="1" />
                  </div>
                  <div>
                    <Label htmlFor="quality">Quality</Label>
                    <Input id="quality" value={quality} onChange={(e) => setQuality(e.target.value)} placeholder="WEB-DL" />
                  </div>
                  <div>
                    <Label htmlFor="releaseName">Release Name</Label>
                    <Input id="releaseName" value={releaseName} onChange={(e) => setReleaseName(e.target.value)} placeholder="..." />
                  </div>
                </div>
              )}

              {seasons.length > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="quality">Quality</Label>
                    <Input id="quality" value={quality} onChange={(e) => setQuality(e.target.value)} placeholder="WEB-DL" />
                  </div>
                  <div>
                    <Label htmlFor="releaseName">Release Name</Label>
                    <Input id="releaseName" value={releaseName} onChange={(e) => setReleaseName(e.target.value)} placeholder="..." />
                  </div>
                </div>
              )}

              {/* ============================================================ */}
              {/* SUBTITLE OFFSET (Sync Adjustment)                            */}
              {/* ============================================================ */}
              <div className="rounded-md border border-orange-500/30 bg-orange-500/5 p-3">
                <Label htmlFor="offsetSeconds">Subtitle Sync Adjustment (detik)</Label>
                <div className="mt-1 flex items-center gap-2">
                  <Input
                    id="offsetSeconds"
                    type="number"
                    step="0.1"
                    value={offsetSeconds}
                    onChange={(e) => setOffsetSeconds(e.target.value)}
                    placeholder="0"
                    className="w-24"
                  />
                  <span className="text-xs text-muted-foreground">
                    {offsetSeconds === "" || offsetSeconds === "0"
                      ? "Tidak ada offset"
                      : Number(offsetSeconds) > 0
                      ? `Subtitle di-delay ${offsetSeconds}s (kalau subtitle terlalu CEPAT)`
                      : `Subtitle di-advance ${Math.abs(Number(offsetSeconds))}s (kalau subtitle terlalu LAMBAT)`}
                  </span>
                </div>
                <div className="mt-2 flex gap-1">
                  <button type="button" onClick={() => setOffsetSeconds(String((Number(offsetSeconds) || 0) - 0.5))}
                    className="rounded bg-muted px-2 py-1 text-xs hover:bg-muted/80">-0.5s</button>
                  <button type="button" onClick={() => setOffsetSeconds(String((Number(offsetSeconds) || 0) + 0.5))}
                    className="rounded bg-muted px-2 py-1 text-xs hover:bg-muted/80">+0.5s</button>
                  <button type="button" onClick={() => setOffsetSeconds(String((Number(offsetSeconds) || 0) - 1))}
                    className="rounded bg-muted px-2 py-1 text-xs hover:bg-muted/80">-1s</button>
                  <button type="button" onClick={() => setOffsetSeconds(String((Number(offsetSeconds) || 0) + 1))}
                    className="rounded bg-muted px-2 py-1 text-xs hover:bg-muted/80">+1s</button>
                  <button type="button" onClick={() => setOffsetSeconds("0")}
                    className="rounded bg-muted px-2 py-1 text-xs hover:bg-muted/80">Reset</button>
                </div>
              </div>

              <div>
                <Label htmlFor="file">Upload .srt File</Label>
                <Input id="file" type="file" accept="*/*" onChange={handleFileUpload} className="cursor-pointer" />
                <p className="mt-1 text-xs text-muted-foreground">
                  Atau paste SRT text langsung di bawah. Pilih "All Files" di file picker kalau perlu.
                </p>
              </div>

              <div>
                <Label htmlFor="subtitleText">Subtitle Text *</Label>
                <textarea id="subtitleText" value={subtitleText} onChange={(e) => setSubtitleText(e.target.value)}
                  placeholder="1&#10;00:00:01,000 --> 00:00:04,000&#10;Subtitle text here..."
                  className="min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs" required />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}
              {success && <p className="text-sm text-green-600">{success}</p>}

              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                {submitting ? "Saving..." : "Save Subtitle"}
              </Button>
            </form>

            {/* EXISTING SUBTITLES WITH SEARCH */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold flex-1">
                  Existing Subtitles ({entries.length})
                </h2>
              </div>

              {/* Search existing subtitles */}
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Cari subtitle yang sudah di-upload..."
                  value={entriesSearch}
                  onChange={(e) => setEntriesSearch(e.target.value)}
                  className="pl-10"
                />
                {entriesSearch && (
                  <button
                    onClick={() => setEntriesSearch("")}
                    className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : entries.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {entriesSearch ? `Tidak ada subtitle untuk "${entriesSearch}"` : "No subtitles yet. Upload one above."}
                </p>
              ) : (
                <div className="space-y-2">
                  {entries.map((entry) => (
                    <div key={entry.id} className="flex items-center gap-3 rounded-lg border bg-card p-3">
                      <FileText className="h-5 w-5 shrink-0 text-primary" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{entry.title}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          <Badge variant="secondary" className="text-[10px]">{entry.type}</Badge>
                          {entry.season && <Badge variant="outline" className="text-[10px]">S{entry.season}</Badge>}
                          {entry.episode && <Badge variant="outline" className="text-[10px]">E{entry.episode}</Badge>}
                          {entry.server && <Badge variant="outline" className="text-[10px] text-purple-600">{entry.server}</Badge>}
                          {entry.quality && <Badge variant="outline" className="text-[10px]">{entry.quality}</Badge>}
                          {entry.offset_ms && entry.offset_ms !== 0 && (
                            <Badge variant="outline" className="text-[10px] text-orange-600">
                              {entry.offset_ms > 0 ? "+" : ""}{(entry.offset_ms / 1000).toFixed(1)}s
                            </Badge>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDelete(entry.id)}
                        className="shrink-0 rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
