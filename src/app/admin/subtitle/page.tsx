"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trash2, Upload, FileText } from "lucide-react";

interface SubtitleEntry {
  id: number;
  title: string;
  type: string;
  season: string | null;
  episode: string | null;
  quality: string | null;
  release_name: string | null;
  updated_at: string;
}

export default function AdminSubtitlePage() {
  const [entries, setEntries] = useState<SubtitleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"movie" | "tv">("movie");
  const [season, setSeason] = useState("");
  const [episode, setEpisode] = useState("");
  const [quality, setQuality] = useState("");
  const [subtitleText, setSubtitleText] = useState("");
  const [releaseName, setReleaseName] = useState("");

  // Get admin API key from localStorage (atau prompt user)
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

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/subtitle", {
        headers: { "X-Admin-API-Key": apiKey },
      });
      if (res.ok) {
        const data = await res.json();
        setEntries(data.subtitles || []);
      } else {
        setError("Failed to load subtitles");
      }
    } catch {
      setError("Network error");
    } finally {
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
          title: title.trim(),
          type,
          season: season || null,
          episode: episode || null,
          quality: quality || null,
          subtitle_text: subtitleText,
          release_name: releaseName || null,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSuccess(data.message || "Subtitle saved");
        // Reset form
        setTitle("");
        setSeason("");
        setEpisode("");
        setQuality("");
        setSubtitleText("");
        setReleaseName("");
        // Refresh list
        fetchEntries();
      } else {
        const err = await res.json();
        setError(err.error || "Failed to save");
      }
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this subtitle?")) return;
    try {
      const res = await fetch(`/api/admin/subtitle/${id}`, {
        method: "DELETE",
        headers: { "X-Admin-API-Key": apiKey },
      });
      if (res.ok) {
        fetchEntries();
      }
    } catch {}
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setSubtitleText(text);
      // Auto-fill release_name from filename
      if (!releaseName) {
        setReleaseName(file.name.replace(/\.(srt|vtt)$/i, ""));
      }
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

        {/* API Key Input */}
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
            <p className="mt-1 text-xs text-muted-foreground">
              Key disimpan di localStorage browser kamu
            </p>
          </div>
        )}

        {/* Upload Form */}
        {apiKey && (
          <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border bg-card p-4">
            <h2 className="text-lg font-semibold">Upload Subtitle</h2>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Obsession"
                  required
                />
              </div>
              <div>
                <Label htmlFor="type">Type</Label>
                <select
                  id="type"
                  value={type}
                  onChange={(e) => setType(e.target.value as "movie" | "tv")}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="movie">Movie</option>
                  <option value="tv">TV Series</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <Label htmlFor="season">Season</Label>
                <Input
                  id="season"
                  value={season}
                  onChange={(e) => setSeason(e.target.value)}
                  placeholder="1"
                />
              </div>
              <div>
                <Label htmlFor="episode">Episode</Label>
                <Input
                  id="episode"
                  value={episode}
                  onChange={(e) => setEpisode(e.target.value)}
                  placeholder="1"
                />
              </div>
              <div>
                <Label htmlFor="quality">Quality</Label>
                <Input
                  id="quality"
                  value={quality}
                  onChange={(e) => setQuality(e.target.value)}
                  placeholder="WEB-DL"
                />
              </div>
              <div>
                <Label htmlFor="releaseName">Release Name</Label>
                <Input
                  id="releaseName"
                  value={releaseName}
                  onChange={(e) => setReleaseName(e.target.value)}
                  placeholder="Obsession.2025.WEB-DL"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="file">Upload .srt File</Label>
              <Input
                id="file"
                type="file"
                accept=".srt,.vtt,.txt"
                onChange={handleFileUpload}
                className="cursor-pointer"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Atau paste SRT text langsung di bawah
              </p>
            </div>

            <div>
              <Label htmlFor="subtitleText">Subtitle Text *</Label>
              <textarea
                id="subtitleText"
                value={subtitleText}
                onChange={(e) => setSubtitleText(e.target.value)}
                placeholder="1&#10;00:00:01,000 --> 00:00:04,000&#10;Subtitle text here..."
                className="min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
                required
              />
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            {success && (
              <p className="text-sm text-green-600">{success}</p>
            )}

            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              {submitting ? "Saving..." : "Save Subtitle"}
            </Button>
          </form>
        )}

        {/* List Existing Subtitles */}
        {apiKey && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">
              Existing Subtitles ({entries.length})
            </h2>

            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : entries.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No subtitles yet. Upload one above.
              </p>
            ) : (
              <div className="space-y-2">
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center gap-3 rounded-lg border bg-card p-3"
                  >
                    <FileText className="h-5 w-5 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{entry.title}</p>
                      <div className="flex flex-wrap items-center gap-1 mt-1">
                        <Badge variant="secondary" className="text-[10px]">
                          {entry.type}
                        </Badge>
                        {entry.season && (
                          <Badge variant="outline" className="text-[10px]">
                            S{entry.season}
                          </Badge>
                        )}
                        {entry.episode && (
                          <Badge variant="outline" className="text-[10px]">
                            E{entry.episode}
                          </Badge>
                        )}
                        {entry.quality && (
                          <Badge variant="outline" className="text-[10px]">
                            {entry.quality}
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
        )}
      </div>
    </div>
  );
}
