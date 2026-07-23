"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Upload } from "lucide-react";
import { saveSubtitle, uploadSubtitleFile } from "@/lib/admin-api";
import type { MediaResult } from "./subtitle-search";

export function SubtitleForm({ 
  apiKey, 
  selectedMedia, 
  onSaved 
}: { 
  apiKey: string; 
  selectedMedia: MediaResult | null;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"movie" | "tv">("movie");
  const [season, setSeason] = useState("");
  const [episode, setEpisode] = useState("");
  const [quality, setQuality] = useState("");
  const [subtitleText, setSubtitleText] = useState("");
  const [releaseName, setReleaseName] = useState("");
  const [offsetSeconds, setOffsetSeconds] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Auto-fill dari media yang dipilih
  useEffect(() => {
    if (selectedMedia) {
      setTitle(selectedMedia.name || selectedMedia.title || "");
      setType(selectedMedia.media_type === "tv" ? "tv" : "movie");
      setSeason("");
      setEpisode("");
    }
  }, [selectedMedia]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text.match(/\d{2}:\d{2}:\d{2}/)) {
        setError("File tidak terlihat sebagai SRT/VTT valid.");
      } else {
        setError(null);
      }
      setSubtitleText(text);
      if (!releaseName) setReleaseName(file.name.replace(/\.(srt|vtt|txt)$/i, ""));
    };
    reader.readAsText(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !subtitleText.trim()) {
      setError("Title dan Subtitle Text wajib diisi");
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      // Coba upload via FormData (lebih efisien untuk file besar)
      const formData = new FormData();
      formData.append("title", title.trim());
      formData.append("type", type);
      formData.append("subtitle_text", subtitleText);
      if (season) formData.append("season", season);
      if (episode) formData.append("episode", episode);
      if (quality) formData.append("quality", quality);
      if (releaseName) formData.append("release_name", releaseName);
      formData.append("offset_seconds", offsetSeconds || "0");

      const result = await uploadSubtitleFile(apiKey, formData);
      
      if (result.ok) {
        setSuccess(result.message || "Subtitle saved");
        // Reset form
        setSubtitleText(""); setReleaseName(""); setOffsetSeconds("");
        setSeason(""); setEpisode(""); setQuality("");
        onSaved();
      } else {
        // Fallback ke JSON API kalau FormData gagal
        const jsonResult = await saveSubtitle(apiKey, {
          title: title.trim(),
          type,
          season: season || null,
          episode: episode || null,
          quality: quality || null,
          subtitle_text: subtitleText,
          release_name: releaseName || null,
          offset_seconds: Number(offsetSeconds) || 0,
        });
        
        if (jsonResult.ok) {
          setSuccess(jsonResult.message || "Subtitle saved");
          setSubtitleText(""); setReleaseName(""); setOffsetSeconds("");
          setSeason(""); setEpisode(""); setQuality("");
          onSaved();
        } else {
          setError(jsonResult.error || "Failed to save");
        }
      }
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
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

      {type === "tv" && (
        <div className="grid grid-cols-2 gap-3 rounded-md border border-blue-500/30 bg-blue-500/5 p-3">
          <div>
            <Label htmlFor="season">Season</Label>
            <Input id="season" type="number" value={season} onChange={(e) => setSeason(e.target.value)} placeholder="1" />
          </div>
          <div>
            <Label htmlFor="episode">Episode</Label>
            <Input id="episode" type="number" value={episode} onChange={(e) => setEpisode(e.target.value)} placeholder="1" />
          </div>
        </div>
      )}

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

      {/* Offset */}
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
          Atau paste SRT text langsung di bawah.
        </p>
      </div>

      <div>
        <Label htmlFor="subtitleText">Subtitle Text *</Label>
        <textarea id="subtitleText" value={subtitleText} onChange={(e) => setSubtitleText(e.target.value)}
          placeholder={"1\n00:00:01,000 --> 00:00:04,000\nSubtitle text here..."}
          className="min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs" required />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && <p className="text-sm text-green-600">{success}</p>}

      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
        {submitting ? "Saving..." : "Save Subtitle"}
      </Button>
    </form>
  );
}
