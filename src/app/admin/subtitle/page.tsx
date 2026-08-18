"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubtitleSearch, type MediaResult } from "@/components/admin/subtitle-search";
import { SubtitleForm } from "@/components/admin/subtitle-form";
import { SubtitleList } from "@/components/admin/subtitle-list";

export default function AdminSubtitlePage() {
  const [apiKey, setApiKey] = useState("");
  const [selectedMedia, setSelectedMedia] = useState<MediaResult | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [editingId, setEditingId] = useState<number | null>(null);  // FIX C: state untuk edit mode

  useEffect(() => {
    const saved = localStorage.getItem("admin_api_key");
    if (saved) setApiKey(saved);
  }, []);

  useEffect(() => {
    if (apiKey) localStorage.setItem("admin_api_key", apiKey);
  }, [apiKey]);

  const handleSaved = () => {
    setRefreshKey(prev => prev + 1);
    setSelectedMedia(null);
    setEditingId(null);  // FIX C: reset edit mode setelah save
  };

  // FIX C: Handler saat user klik tombol Edit di list
  const handleEdit = (id: number) => {
    setSelectedMedia(null);  // clear selected media (jangan bentrok)
    setEditingId(id);
    // Scroll to form
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 100);
  };

  // FIX C: Handler saat user cancel edit
  const handleCancelEdit = () => {
    setEditingId(null);
  };

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Subtitle Manager</h1>
          <p className="text-sm text-muted-foreground">
            Upload, edit, dan kelola subtitle manual (no expiry, replace kapan saja)
          </p>
        </div>

        {!apiKey ? (
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
        ) : (
          <>
            {/* FIX C: Hide search saat mode edit (karena title di-disable) */}
            {!editingId && (
              <SubtitleSearch onSelect={setSelectedMedia} />
            )}

            <SubtitleForm
              apiKey={apiKey}
              selectedMedia={selectedMedia}
              onSaved={handleSaved}
              editingId={editingId}
              onCancelEdit={handleCancelEdit}
            />

            <SubtitleList
              apiKey={apiKey}
              refreshKey={refreshKey}
              onEdit={handleEdit}
            />
          </>
        )}
      </div>
    </div>
  );
}
