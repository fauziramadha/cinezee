"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, FileText, X, Pencil } from "lucide-react";
import { saveSubtitle, fetchSubtitleById, type FullSubtitle } from "@/lib/admin-api";
import type { MediaResult } from "./subtitle-search";

const VPS_API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "https://api.cinestream.biz.id";

const VPS_API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "https://api.cinestream.biz.id";

interface SubtitleFormProps {
  apiKey: string;
  selectedMedia: MediaResult | null;
  onSaved: () => void;
  editingId: number | null;     // FIX C: ID subtitle yang sedang di-edit
  onCancelEdit: () => void;     // FIX C: callback untuk cancel edit mode
}

export function SubtitleForm({
  apiKey,
  selectedMedia,
  onSaved,
  editingId,
  onCancelEdit,
}: SubtitleFormProps) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"movie" | "tv">("movie");
  const [season, setSeason] = useState("");
  const [episode, setEpisode] = useState("");
  const [quality, setQuality] = useState("");
  const [subtitleText, setSubtitleText] = useState("");
  const [releaseName, setReleaseName] = useState("");
  const [offsetSeconds, setOffsetSeconds] = useState("");
  const [server, setServer] = useState("");
  const [availableServers, setAvailableServers] = useState<{id: number; title: string}[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(false);  // FIX C: loading saat fetch data edit
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // FIX C: Saat selectedMedia berubah (dari search), pre-fill form (mode create)
  useEffect(() => {
    if (selectedMedia && !editingId) {
      setTitle(selectedMedia.title || "");
      setType(selectedMedia.type === "tv" ? "tv" : "movie");
      setSeason("");
      setEpisode("");
      setServer("");
      setAvailableServers([]);
      // Fetch servers list dari VPS API
      const fetchServers = async () => {
        try {
          const res = await fetch(`${VPS_API_BASE}/api/stream/info/${selectedMedia.cinemacity_id}?slug=${selectedMedia.slug}&type=${selectedMedia.type}`);
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.data?.servers?.length > 1) {
              setAvailableServers(data.data.servers);
            }
          }
        } catch {}
      };
      fetchServers();
    }
  }, [selectedMedia, editingId]);

  // FIX C: Saat editingId berubah, fetch data subtitle untuk pre-fill form (mode edit)
  useEffect(() => {
    if (!editingId) {
      // Reset form ke mode create
      if (!selectedMedia) {
        setTitle("");
        setType("movie");
      }
      setSeason("");
      setEpisode("");
      setQuality("");
      setSubtitleText("");
      setReleaseName("");
      setOffsetSeconds("");
      setFileName("");
      return;
    }

    // Mode edit: fetch subtitle by ID
    let cancelled = false;
    setLoadingEdit(true);
    setError(null);

    async function loadForEdit() {
      const sub = await fetchSubtitleById(apiKey, editingId!);
      if (cancelled) return;
      if (sub) {
        setTitle(sub.title);
        setType(sub.type === "tv" ? "tv" : "movie");
        setSeason(sub.season || "");
        setEpisode(sub.episode || "");
        setQuality(sub.quality || "");
        setSubtitleText(sub.subtitle_text);
        setReleaseName(sub.release_name || "");
        setOffsetSeconds(sub.offset_ms ? String(sub.offset_ms / 1000) : "");
        setServer(sub.server || "");
        setFileName("(existing subtitle)");
      } else {
        setError("Failed to load subtitle for edit");
      }
      setLoadingEdit(false);
    }

    loadForEdit();

    return () => {
      cancelled = true;
    };
  }, [editingId, apiKey]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileNameLower = file.name.toLowerCase();
    const isValidExt = fileNameLower.endsWith(".srt") || fileNameLower.endsWith(".vtt") || fileNameLower.endsWith(".txt");
    if (!isValidExt) {
      setError(`File "${file.name}" bukan format subtitle. Hanya .srt, .vtt, .txt yang didukung.`);
      setFileName("");
      setSubtitleText("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setFileName(file.name);
    setError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text.match(/\d{2}:\d{2}:\d{2}/)) {
        setError("File tidak terlihat sebagai SRT/VTT valid (tidak ada timestamp).");
      }
      setSubtitleText(text);
      if (!releaseName) setReleaseName(file.name.replace(/\.(srt|vtt|txt)$/i, ""));
    };
    reader.readAsText(file);
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  // FIX C: Cancel edit mode - reset form + call onCancelEdit
  const handleCancelEdit = () => {
    onCancelEdit();
    setSubtitleText("");
    setReleaseName("");
    setOffsetSeconds("");
    setQuality("");
    setServer("");
    setAvailableServers([]);
    setFileName("");
    setError(null);
    setSuccess(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
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
      const result = await saveSubtitle(apiKey, {
        title: title.trim(),
        type,
        season: season || null,
        episode: episode || null,
        server: server || null,
        quality: quality || null,
        subtitle_text: subtitleText,
        release_name: releaseName || null,
        offset_seconds: Number(offsetSeconds) || 0,
      });

      if (result.ok) {
        setSuccess(result.message || "Subtitle saved");
        setSubtitleText("");
        setReleaseName("");
        setOffsetSeconds("");
        setSeason("");
        setEpisode("");
        setQuality("");
        setServer("");
        setAvailableServers([]);
        setFileName("");
        if (fileInputRef.current) fileInputRef.current.value = "";
        // FIX C: Kalau mode edit, exit edit mode
        if (editingId) {
          onCancelEdit();
        }
        onSaved();
      } else {
        setError(result.error || "Failed to save");
      }
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  // FIX C: Header berubah tergantung mode
  const isEditMode = !!editingId;

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          {isEditMode ? (
            <>
              <Pencil className="h-5 w-5 text-primary" />
              Edit Subtitle
            </>
          ) : (
            <>
              <Upload className="h-5 w-5" />
              Upload Subtitle
            </>
          )}
        </h2>

        {isEditMode && (
          <button
            type="button"
            onClick={handleCancelEdit}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-3 w-3" />
            Cancel Edit
          </button>
        )}
      </div>

      {/* FIX C: Loading indicator saat fetch data edit */}
      {loadingEdit && (
        <div className="flex items-center gap-2 rounded-md bg-muted p-3 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading subtitle data...
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="title">Title *</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Cari film di atas dulu..."
            required
            disabled={isEditMode}  // FIX C: disable title di mode edit (key untuk upsert)
          />
          {isEditMode && (
            <p className="mt-1 text-[10px] text-muted-foreground">
              Title tidak bisa diubah saat edit (digunakan sebagai key untuk update)
            </p>
          )}
        </div>
        <div>
          <Label htmlFor="type">Type</Label>
          <select
            id="type"
            value={type}
            onChange={(e) => setType(e.target.value as "movie" | "tv")}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            disabled={isEditMode}  // FIX C: disable type di mode edit
          >
            <option value="movie">Movie</option>
            <option value="tv">TV Series</option>
          </select>
        </div>
      </div>

      {type === "tv" && (
        <div className="grid grid-cols-2 gap-3 rounded-md border border-blue-500/30 bg-blue-500/5 p-3">
          <div>
            <Label htmlFor="season">Season</Label>
            <Input
              id="season"
              type="number"
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              placeholder="1"
              disabled={isEditMode}  // FIX C: disable season/episode di mode edit
            />
          </div>
          <div>
            <Label htmlFor="episode">Episode</Label>
            <Input
              id="episode"
              type="number"
              value={episode}
              onChange={(e) => setEpisode(e.target.value)}
              placeholder="1"
              disabled={isEditMode}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
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
            placeholder="..."
          />
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

      {/* File upload */}
      <div>
        <Label>Pilih File Subtitle {isEditMode && "(opsional - biarkan untuk pakai text yang ada)"}</Label>
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileUpload}
          className="sr-only"
          tabIndex={-1}
        />
        <button
          type="button"
          onClick={handleBrowseClick}
          className="mt-1 flex w-full items-center gap-3 rounded-md border border-dashed border-input bg-background px-4 py-3 text-left transition hover:bg-muted/50"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
            {fileName ? <FileText className="h-5 w-5 text-primary" /> : <Upload className="h-5 w-5 text-muted-foreground" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {fileName || "Klik untuk pilih file (.srt / .vtt / .txt)"}
            </p>
            <p className="text-xs text-muted-foreground">
              {fileName ? "File dipilih. Atau edit text langsung di bawah." : "Atau paste SRT text langsung di bawah."}
            </p>
          </div>
        </button>
      </div>

      <div>
        <Label htmlFor="subtitleText">Subtitle Text *</Label>
        <textarea
          id="subtitleText"
          value={subtitleText}
          onChange={(e) => setSubtitleText(e.target.value)}
          placeholder={"1\n00:00:01,000 --> 00:00:04,000\nSubtitle text here..."}
          className="min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
          required
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && <p className="text-sm text-green-600">{success}</p>}

      <Button type="submit" disabled={submitting || loadingEdit} className="w-full">
        {submitting ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : isEditMode ? (
          <Pencil className="mr-2 h-4 w-4" />
        ) : (
          <Upload className="mr-2 h-4 w-4" />
        )}
        {submitting
          ? "Saving..."
          : isEditMode
          ? "Update Subtitle"
          : "Save Subtitle"}
      </Button>
    </form>
  );
}
