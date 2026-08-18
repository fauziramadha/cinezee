"use client";

import { useState, useRef } from "react";
import { Upload, Loader2, Check, X, Search, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const VPS_API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "https://api.cinestream.my.id";

interface SubtitleFile {
  file: File;
  text: string;
  season: string;
  episode: string;
  status: "pending" | "uploading" | "success" | "error";
  error?: string;
}

interface MediaResult {
  cinemacity_id: string;
  slug: string;
  title: string;
  type: "movie" | "tv";
  poster_url: string | null;
  release_year: number | null;
}

function parseFilename(filename: string): { season?: string; episode?: string } {
  const name = filename.toLowerCase().replace(/\.[^.]+$/, "");
  let match = name.match(/s(\d+)e(\d+)/);
  if (match) return { season: String(parseInt(match[1])), episode: String(parseInt(match[2])) };
  match = name.match(/(\d+)x(\d+)/);
  if (match) return { season: String(parseInt(match[1])), episode: String(parseInt(match[2])) };
  match = name.match(/season\s*(\d+).*episode\s*(\d+)/);
  if (match) return { season: String(parseInt(match[1])), episode: String(parseInt(match[2])) };
  match = name.match(/ep(?:isode)?\.?\s*(\d+)/);
  if (match) return { episode: String(parseInt(match[1])) };
  return {};
}

export default function BatchSubtitlePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MediaResult[]>([]);
  const [selectedShow, setSelectedShow] = useState<MediaResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [files, setFiles] = useState<SubtitleFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [defaultSeason, setDefaultSeason] = useState("1");
  const [apiKey, setApiKey] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load API Key
  useState(() => {
    const saved = localStorage.getItem("admin_api_key");
    if (saved) setApiKey(saved);
  });

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      // FIX: Pakai VPS API /api/search (bukan /api/tmdb/search/tv yang tidak ada)
      const res = await fetch(`${VPS_API_BASE}/api/search?q=${encodeURIComponent(searchQuery)}`);
      if (res.ok) {
        const json = await res.json();
        const items = (json.data?.results || []).slice(0, 10).map((item: any): MediaResult => ({
          cinemacity_id: String(item.cinemacity_id || item.id),
          slug: item.slug || "",
          title: item.title || "Untitled",
          type: item.type === "tv" ? "tv" : "movie",
          poster_url: item.poster_url || null,
          release_year: item.release_year || null,
        }));
        setSearchResults(items);
      }
    } catch {}
    setSearching(false);
  };

  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const subtitleFiles: SubtitleFile[] = [];

    for (const file of selectedFiles) {
      if (file.name.endsWith(".srt") || file.name.endsWith(".vtt")) {
        const text = await readFileAsText(file);
        const parsed = parseFilename(file.name);
        subtitleFiles.push({
          file,
          text,
          season: parsed.season || defaultSeason,
          episode: parsed.episode || "",
          status: "pending",
        });
      }
    }
    setFiles(prev => [...prev, ...subtitleFiles]);
  };

  const removeFile = (idx: number) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const updateFile = (idx: number, field: "season" | "episode", value: string) => {
    setFiles(prev => prev.map((f, i) => i === idx ? { ...f, [field]: value } : f));
  };

  const handleUploadAll = async () => {
    if (!selectedShow || files.length === 0 || !apiKey) return;
    setUploading(true);

    for (let i = 0; i < files.length; i++) {
      if (files[i].status === "success") continue;

      setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: "uploading" } : f));

      try {
        const res = await fetch("/api/admin/subtitle", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Admin-API-Key": apiKey,
          },
          body: JSON.stringify({
            title: selectedShow.title,
            type: selectedShow.type,
            season: selectedShow.type === "tv" ? files[i].season : null,
            episode: selectedShow.type === "tv" ? (files[i].episode || String(i + 1)) : null,
            subtitle_text: files[i].text,
            offset_seconds: 0,
          }),
        });

        if (res.ok) {
          setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: "success" } : f));
        } else {
          const err = await res.text();
          setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: "error", error: err } : f));
        }
      } catch (e: any) {
        setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: "error", error: e.message } : f));
      }
    }

    setUploading(false);
  };

  return (
    <div className="min-h-screen bg-zinc-950 p-4 sm:p-6">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-6 text-2xl font-bold text-white">Batch Upload Subtitle</h1>

        {!apiKey && (
          <div className="mb-4 rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4">
            <label className="text-sm font-semibold text-white">Admin API Key</label>
            <Input
              type="password"
              placeholder="Paste your ADMIN_API_KEY"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="mt-1 bg-zinc-900 text-white"
            />
          </div>
        )}

        {apiKey && (
          <>
            {!selectedShow && (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Cari judul Film / TV Series..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    className="bg-zinc-900 text-white"
                  />
                  <Button onClick={handleSearch} disabled={searching}>
                    {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </Button>
                </div>

                <div className="space-y-2">
                  {searchResults.map(show => (
                    <button
                      key={`${show.cinemacity_id}-${show.type}`}
                      onClick={() => setSelectedShow(show)}
                      className="flex w-full items-center gap-3 rounded-lg bg-zinc-900 p-3 text-left transition hover:bg-zinc-800"
                    >
                      {show.poster_url ? (
                        <img src={`${VPS_API_BASE}/api/image?url=${encodeURIComponent(show.poster_url)}`} alt="" className="h-16 w-12 rounded object-cover" />
                      ) : (
                        <div className="flex h-16 w-12 items-center justify-center rounded bg-zinc-800">
                          <Film className="h-6 w-6 text-zinc-600" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-white">{show.title}</p>
                        <p className="text-xs text-zinc-400">
                          {show.type === "tv" ? "TV Series" : "Movie"}{show.release_year ? ` · ${show.release_year}` : ""}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedShow && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 rounded-lg bg-zinc-900 p-3">
                  {selectedShow.poster_url && (
                    <img src={`${VPS_API_BASE}/api/image?url=${encodeURIComponent(selectedShow.poster_url)}`} alt="" className="h-16 w-12 rounded object-cover" />
                  )}
                  <div className="flex-1">
                    <p className="font-medium text-white">{selectedShow.title}</p>
                    <p className="text-xs text-zinc-400">
                      {selectedShow.type === "tv" ? "TV Series" : "Movie"}{selectedShow.release_year ? ` · ${selectedShow.release_year}` : ""}
                    </p>
                    <button
                      onClick={() => { setSelectedShow(null); setFiles([]); }}
                      className="text-xs text-red-400 hover:underline"
                    >
                      Ganti Pilihan
                    </button>
                  </div>
                </div>

                {/* Default Season — hanya untuk TV */}
                {selectedShow.type === "tv" && (
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-zinc-400">Default Season:</label>
                    <Input
                      type="number"
                      value={defaultSeason}
                      onChange={(e) => setDefaultSeason(e.target.value)}
                      className="w-20 bg-zinc-900 text-white"
                    />
                  </div>
                )}

                <div className="rounded-lg border-2 border-dashed border-zinc-700 p-6 text-center">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".srt,.vtt"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef?.current?.click()}
                    className="flex flex-col items-center gap-2"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800">
                      <Upload className="h-6 w-6 text-white" />
                    </div>
                    <span className="text-sm text-white">Pilih file subtitle (.srt / .vtt)</span>
                    <span className="text-xs text-zinc-500">Bisa pilih multiple file sekaligus</span>
                  </button>
                </div>

                {files.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-zinc-400">{files.length} file dipilih</p>
                      <Button
                        onClick={handleUploadAll}
                        disabled={uploading || files.every(f => f.status === "success")}
                        size="sm"
                      >
                        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        Upload Semua
                      </Button>
                    </div>

                    {files.map((f, idx) => (
                      <div key={idx} className="flex items-center gap-2 rounded-lg bg-zinc-900 p-2">
                        <div className="shrink-0">
                          {f.status === "success" ? (
                            <Check className="h-5 w-5 text-green-500" />
                          ) : f.status === "uploading" ? (
                            <Loader2 className="h-5 w-5 animate-spin text-yellow-500" />
                          ) : f.status === "error" ? (
                            <X className="h-5 w-5 text-red-500" />
                          ) : (
                            <div className="h-5 w-5 rounded-full border-2 border-zinc-600" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs text-white">{f.file.name}</p>
                          {f.error && <p className="text-xs text-red-400">{f.error}</p>}
                        </div>

                        {/* Season + Episode input hanya untuk TV */}
                        {selectedShow.type === "tv" && (
                          <>
                            <input
                              type="number"
                              value={f.season}
                              onChange={(e) => updateFile(idx, "season", e.target.value)}
                              disabled={f.status === "success"}
                              className="w-12 rounded bg-zinc-800 px-1 py-1 text-center text-xs text-white disabled:opacity-50"
                              placeholder="S"
                            />
                            <input
                              type="number"
                              value={f.episode}
                              onChange={(e) => updateFile(idx, "episode", e.target.value)}
                              disabled={f.status === "success"}
                              className="w-12 rounded bg-zinc-800 px-1 py-1 text-center text-xs text-white disabled:opacity-50"
                              placeholder="E"
                            />
                          </>
                        )}

                        {f.status !== "uploading" && (
                          <button
                            onClick={() => removeFile(idx)}
                            className="shrink-0 text-zinc-500 hover:text-red-400"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
