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
            <SubtitleSearch onSelect={setSelectedMedia} />
            <SubtitleForm 
              apiKey={apiKey} 
              selectedMedia={selectedMedia} 
              onSaved={handleSaved}
            />
            <SubtitleList apiKey={apiKey} refreshKey={refreshKey} />
          </>
        )}
      </div>
    </div>
  );
}
