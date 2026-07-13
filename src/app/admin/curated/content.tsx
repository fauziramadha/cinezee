"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/cinepro/header";
import { Footer } from "@/components/cinepro/footer";
import { Loader2, Trash2, Plus, Film, Tv, CheckCircle, Subtitles, Play, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { getImageUrl } from "@/lib/tmdb";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface CuratedItem {
  id: number;
  tmdb_id: number;
  tmdb_type: string;
  title: string;
  poster_path: string;
  status: string;
  stream_url: string;
  stream_type: string;
  quality: string;
  subtitle_url: string;
}

// Auto-generate embed URLs dari berbagai provider
const EMBED_PROVIDERS = [
  { name: "vidsrc.xyz", getUrl: (id: string, type: string, s?: string, e?: string) => 
    type === "tv" ? `https://vidsrc.xyz/embed/tv/${id}/${s||1}/${e||1}` : `https://vidsrc.xyz/embed/movie/${id}` },
  { name: "vidsrc.to", getUrl: (id: string, type: string, s?: string, e?: string) => 
    type === "tv" ? `https://vidsrc.to/embed/tv/${id}/${s||1}/${e||1}` : `https://vidsrc.to/embed/movie/${id}` },
  { name: "vaplayer.ru", getUrl: (id: string, type: string, s?: string, e?: string) => 
    type === "tv" ? `https://vaplayer.ru/embed/tv/${id}/${s||1}/${e||1}` : `https://vaplayer.ru/embed/movie/${id}` },
  { name: "2embed.cc", getUrl: (id: string, type: string, s?: string, e?: string) => 
    type === "tv" ? `https://www.2embed.cc/embedtv/${id}&s=${s||1}&e=${e||1}` : `https://www.2embed.cc/embed/${id}` },
  { name: "multiembed", getUrl: (id: string, type: string, s?: string, e?: string) => 
    type === "tv" ? `https://multiembed.mov/?video_id=${id}&tmdb=1&s=${s||1}&e=${e||1}` : `https://multiembed.mov/?video_id=${id}&tmdb=1` },
];

export function CuratedContent() {
  const [items, setItems] = useState<CuratedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  
  // Dialog state
  const [selectedMovie, setSelectedMovie] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState(0);
  const [customStreamUrl, setCustomStreamUrl] = useState("");
  const [quality, setQuality] = useState("HD");
  const [season, setSeason] = useState("1");
  const [episode, setEpisode] = useState("1");
  
  // Subtitle state
  const [subtitleUrl, setSubtitleUrl] = useState("");
  const [subtitleSource, setSubtitleSource] = useState("");
  const [subtitleLoading, setSubtitleLoading] = useState(false);
  
  // Test player
  const [testPlayerUrl, setTestPlayerUrl] = useState("");
  const [testPlayerOpen, setTestPlayerOpen] = useState(false);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/curated");
      const json = await res.json();
      if (json.success) setItems(json.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleSearch = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && searchQuery.trim()) {
      setSearching(true);
      try {
        const res = await fetch("/api/search?q=" + encodeURIComponent(searchQuery.trim()));
        const json = await res.json();
        setSearchResults(json.results || []);
      } catch (err) {
        console.error(err);
      } finally {
        setSearching(false);
      }
    }
  };

  const handleAddMovie = (movie: any) => {
    setSelectedMovie(movie);
    const type = movie.media_type || (movie.title ? "movie" : "tv");
    setSelectedProvider(0);
    setCustomStreamUrl(EMBED_PROVIDERS[0].getUrl(String(movie.id), type));
    setQuality("HD");
    setSubtitleUrl("");
    setSubtitleSource("");
    setDialogOpen(true);
  };

  const handleProviderChange = (idx: number) => {
    setSelectedProvider(idx);
    const type = selectedMovie?.media_type || (selectedMovie?.title ? "movie" : "tv");
    setCustomStreamUrl(EMBED_PROVIDERS[idx].getUrl(String(selectedMovie.id), type, season, episode));
  };

  const handleFetchSubtitle = async () => {
    if (!selectedMovie) return;
    setSubtitleLoading(true);
    setSubtitleUrl("");
    setSubtitleSource("");
    
    try {
      const type = selectedMovie.media_type || (selectedMovie.title ? "movie" : "tv");
      const params = new URLSearchParams({
        tmdb_id: String(selectedMovie.id),
        type: type,
        title: selectedMovie.title || selectedMovie.name || "",
      });
      if (type === "tv") {
        params.set("season", season);
        params.set("episode", episode);
      }

      const res = await fetch("/api/subtitle/search?" + params.toString());
      const json = await res.json();

      if (json.success) {
        // Convert ke VTT via our proxy
        const vttUrl = "/api/subtitle/convert?url=" + encodeURIComponent(json.subtitle_url);
        setSubtitleUrl(vttUrl);
        setSubtitleSource(json.source);
        toast.success("Subtitle ditemukan dari " + json.source);
      } else {
        toast.error("Subtitle Indonesia tidak ditemukan");
      }
    } catch (err) {
      toast.error("Gagal fetch subtitle");
    } finally {
      setSubtitleLoading(false);
    }
  };

  const handleTestPlayer = () => {
    setTestPlayerUrl(customStreamUrl);
    setTestPlayerOpen(true);
  };

  const handleSave = async () => {
    if (!selectedMovie) return;
    
    try {
      const res = await fetch("/api/admin/curated", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tmdb_id: selectedMovie.id,
          tmdb_type: selectedMovie.media_type || (selectedMovie.title ? "movie" : "tv"),
          title: selectedMovie.title || selectedMovie.name,
          poster_path: selectedMovie.poster_path,
          stream_url: customStreamUrl,
          stream_type: "iframe",
          quality: quality,
          status: "approved",
          subtitle_url: subtitleUrl,
        }),
      });
      
      if (res.ok) {
        toast.success("Film berhasil di-approve!");
        setDialogOpen(false);
        fetchItems();
      }
    } catch (err) {
      toast.error("Gagal menyimpan");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await fetch("/api/admin/curated/" + id, { method: "DELETE" });
      fetchItems();
      toast.success("Dihapus");
    } catch (err) {
      console.error(err);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("URL disalin");
  };

  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8 pt-24">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Curated Movies</h1>
          <p className="text-sm text-muted-foreground">
            Cari film → pilih embed provider → fetch subtitle → test play → approve
          </p>
        </div>

        {/* Search Section */}
        <div className="mb-8 rounded-lg border border-border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold">Cari Film TMDB</h3>
          <Input
            type="text"
            placeholder="Cari judul film..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearch}
            className="mb-4"
          />
          
          {searching && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}

          {searchResults.length > 0 && (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
              {searchResults.slice(0, 12).map((movie) => (
                <div key={movie.id} className="relative group">
                  <div className="aspect-[2/3] overflow-hidden rounded-lg bg-muted">
                    {movie.poster_path ? (
                      <img 
                        src={getImageUrl(movie.poster_path, "w300")} 
                        alt={movie.title || movie.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        {movie.media_type === "tv" ? <Tv className="h-8 w-8" /> : <Film className="h-8 w-8" />}
                      </div>
                    )}
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center bg-black/70 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button size="sm" onClick={() => handleAddMovie(movie)}>
                      <Plus className="h-4 w-4" /> Tambah
                    </Button>
                  </div>
                  <p className="mt-1 line-clamp-1 text-[10px] text-muted-foreground">
                    {movie.title || movie.name}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Curated List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <p>Belum ada film di-curate. Cari dan tambahkan di atas.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Film yang Sudah Di-approve ({items.length})</h3>
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-4 rounded-lg border border-border bg-card p-3">
                <div className="h-16 w-12 shrink-0 overflow-hidden rounded bg-muted">
                  {item.poster_path && (
                    <img 
                      src={getImageUrl(item.poster_path, "w154")} 
                      alt={item.title}
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-medium truncate">{item.title}</h4>
                    <Badge variant="outline">{item.tmdb_type}</Badge>
                    <Badge variant="secondary">{item.quality}</Badge>
                    {item.subtitle_url && (
                      <Badge className="bg-blue-500 gap-1">
                        <Subtitles className="h-3 w-3" /> Sub Indo
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-1">
                    {item.stream_url || "No stream URL"}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Badge className="bg-green-500">Approved</Badge>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="h-8 w-8 text-red-500"
                    onClick={() => handleDelete(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dialog Tambah + Config Film */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Konfigurasi & Approve Film</DialogTitle>
          </DialogHeader>
          
          {selectedMovie && (
            <div className="space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Movie Info */}
              <div className="flex items-center gap-4">
                <div className="h-24 w-16 overflow-hidden rounded bg-muted shrink-0">
                  {selectedMovie.poster_path && (
                    <img 
                      src={getImageUrl(selectedMovie.poster_path, "w154")} 
                      alt={selectedMovie.title}
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
                <div>
                  <h3 className="font-semibold">{selectedMovie.title || selectedMovie.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedMovie.media_type || (selectedMovie.title ? "Movie" : "TV")} • TMDB ID: {selectedMovie.id}
                  </p>
                </div>
              </div>

              {/* TV Series: Season + Episode */}
              {(selectedMovie.media_type === "tv" || (!selectedMovie.media_type && !selectedMovie.title)) && (
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-xs font-medium">Season</label>
                    <Input type="number" value={season} onChange={(e) => setSeason(e.target.value)} className="mt-1" />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs font-medium">Episode</label>
                    <Input type="number" value={episode} onChange={(e) => setEpisode(e.target.value)} className="mt-1" />
                  </div>
                </div>
              )}

              {/* Embed Provider Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Pilih Embed Provider</label>
                <div className="flex flex-wrap gap-2">
                  {EMBED_PROVIDERS.map((provider, idx) => (
                    <button
                      key={provider.name}
                      onClick={() => handleProviderChange(idx)}
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                        selectedProvider === idx
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-card hover:bg-muted"
                      )}
                    >
                      {provider.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stream URL (editable) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Stream URL</label>
                  <button onClick={() => copyToClipboard(customStreamUrl)} className="text-xs text-primary hover:underline flex items-center gap-1">
                    <Copy className="h-3 w-3" /> Copy
                  </button>
                </div>
                <Input
                  type="text"
                  value={customStreamUrl}
                  onChange={(e) => setCustomStreamUrl(e.target.value)}
                  placeholder="Stream URL..."
                />
                <p className="text-xs text-muted-foreground">
                  URL otomatis ter-generate. Bisa di-edit manual jika perlu.
                </p>
              </div>

              {/* Quality Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Quality Badge</label>
                <div className="flex gap-2">
                  {["CAM", "HD", "WEB-DL", "4K"].map((q) => (
                    <button
                      key={q}
                      onClick={() => setQuality(q)}
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                        quality === q
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-card hover:bg-muted"
                      )}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              {/* Subtitle */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Subtitle Indonesia</label>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleFetchSubtitle}
                    disabled={subtitleLoading}
                    className="gap-1.5"
                  >
                    {subtitleLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Subtitles className="h-3.5 w-3.5" />}
                    {subtitleLoading ? "Mencari..." : "Cari Subtitle"}
                  </Button>
                </div>
                {subtitleUrl && (
                  <div className="flex items-center gap-2 rounded-lg border border-green-500/40 bg-green-500/10 p-2">
                    <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                    <p className="text-xs text-green-600 truncate flex-1">
                      Subtitle dari {subtitleSource}
                    </p>
                    <Badge variant="outline" className="text-green-600">VTT Ready</Badge>
                  </div>
                )}
                {!subtitleUrl && !subtitleLoading && (
                  <p className="text-xs text-muted-foreground">
                    Klik "Cari Subtitle" untuk auto-fetch dari OpenSubtitles / SubDL / SubSource
                  </p>
                )}
              </div>

              {/* Test Player */}
              <div className="space-y-2">
                <Button
                  variant="outline"
                  onClick={handleTestPlayer}
                  className="w-full gap-2"
                >
                  <Play className="h-4 w-4" /> Test Player
                </Button>
              </div>

              {/* Approve Button */}
              <Button className="w-full gap-2" onClick={handleSave}>
                <CheckCircle className="h-4 w-4" /> Approve & Publish
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Test Player Dialog */}
      <Dialog open={testPlayerOpen} onOpenChange={setTestPlayerOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Test Player</DialogTitle>
          </DialogHeader>
          <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
            {testPlayerUrl && (
              <iframe
                src={testPlayerUrl}
                className="h-full w-full"
                allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
              />
            )}
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Jika video muncul → URL valid. Tutup lalu Approve.
          </p>
        </DialogContent>
      </Dialog>

      <Footer />
    </main>
  );
}
