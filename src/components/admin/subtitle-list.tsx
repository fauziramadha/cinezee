"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trash2, FileText, Search, X, Pencil } from "lucide-react";
import { fetchSubtitles, type SubtitleEntry } from "@/lib/admin-api";

interface SubtitleListProps {
  apiKey: string;
  refreshKey: number;
  onEdit: (id: number) => void;  // FIX C: callback untuk edit
}

export function SubtitleList({ apiKey, refreshKey, onEdit }: SubtitleListProps) {
  const [entries, setEntries] = useState<SubtitleEntry[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    const data = await fetchSubtitles(apiKey, search || undefined);
    setEntries(data);
    setLoading(false);
  };

  useEffect(() => {
    if (apiKey) load();
  }, [apiKey, search, refreshKey]);

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this subtitle?")) return;
    const { deleteSubtitle } = await import("@/lib/admin-api");
    const ok = await deleteSubtitle(apiKey, id);
    if (ok) load();
  };

  const handleEditClick = (id: number) => {
    setEditingId(id);
    onEdit(id);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold flex-1">
          Existing Subtitles ({entries.length})
        </h2>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Cari subtitle..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
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
          {search ? `Tidak ada subtitle untuk "${search}"` : "No subtitles yet."}
        </p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className={`flex items-center gap-3 rounded-lg border bg-card p-3 transition ${
                editingId === entry.id ? "ring-2 ring-primary" : ""
              }`}
            >
              <FileText className="h-5 w-5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{entry.title}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  <Badge variant="secondary" className="text-[10px]">{entry.type}</Badge>
                  {entry.season && <Badge variant="outline" className="text-[10px]">S{entry.season}</Badge>}
                  {entry.episode && <Badge variant="outline" className="text-[10px]">E{entry.episode}</Badge>}
                  {entry.quality && <Badge variant="outline" className="text-[10px]">{entry.quality}</Badge>}
                  {entry.server && <Badge variant="outline" className="text-[10px] text-purple-600">Server {entry.server}</Badge>}
                  {entry.offset_ms && entry.offset_ms !== 0 && (
                    <Badge variant="outline" className="text-[10px] text-orange-600">
                      {entry.offset_ms > 0 ? "+" : ""}{(entry.offset_ms / 1000).toFixed(1)}s
                    </Badge>
                  )}
                </div>
              </div>

              {/* FIX C: Tombol Edit */}
              <button
                onClick={() => handleEditClick(entry.id)}
                className="shrink-0 rounded-md p-2 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                aria-label="Edit subtitle"
              >
                <Pencil className="h-4 w-4" />
              </button>

              <button
                onClick={() => handleDelete(entry.id)}
                className="shrink-0 rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                aria-label="Delete subtitle"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
