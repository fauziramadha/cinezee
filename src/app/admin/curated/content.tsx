"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/cinepro/header";
import { Footer } from "@/components/cinepro/footer";
import { Loader2, CheckCircle, XCircle, Trash2, Plus, Film, Tv } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import { useAppStore } from "@/lib/store";
import { getImageUrl } from "@/lib/tmdb";

interface CuratedItem {
  id: number;
  tmdb_id: number;
  tmdb_type: string;
  title: string;
  poster_path: string;
  status: string;
  stream_url: string;
  quality: string;
}

export function CuratedContent() {
  const [items, setItems] = useState<CuratedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  
  const [selectedMovie, setSelectedMovie] = useState<any>(null);
  const [streamUrl, setStreamUrl] = useState("");
  const [quality, setQuality] = useState("HD");
  const [dialogOpen, setDialogOpen] = useState(false);

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
        const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery.trim())}`);
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
    setStreamUrl("");
    setQuality("HD");
    setDialogOpen(true);
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
          stream_url: streamUrl,
          stream_type: "iframe",
          quality: quality,
          status: "approved" // Langsung approve saat ditambah
        }),
      });
      
      if (res.ok) {
        setDialogOpen(false);
        fetchItems();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateStatus = async (id: number, status: string) => {
    try {
      await fetch(`/api/admin/curated/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      fetchItems();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await fetch(`/api/admin/curated/${id}`, { method: "DELETE" });
      fetchItems();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8 pt-24">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Curated Movies</h1>
            <p className="text-sm text-muted-foreground">Kelola film yang tayang di CineStream</p>
          </div>
        </div>

        {/* Search Section */}
        <div className="mb-8 rounded-lg border border-border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold">Cari Film TMDB untuk Ditambahkan</h3>
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
            <p>Belum ada film yang di-curate. Cari dan tambahkan film di atas.</p>
          </div>
        ) : (
          <div className="space-y-3">
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
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium truncate">{item.title}</h4>
                    <Badge variant="outline" className="shrink-0">{item.tmdb_type}</Badge>
                    <Badge variant="secondary" className="shrink-0">{item.quality}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-1">
                    {item.stream_url || "No stream URL"}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {item.status === "approved" ? (
                    <Badge className="bg-green-500">Approved</Badge>
                  ) : (
                    <Badge variant="outline">Pending</Badge>
                  )}
                  
                  {item.status !== "approved" && (
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-8 w-8 text-green-500"
                      onClick={() => handleUpdateStatus(item.id, "approved")}
                    >
                      <CheckCircle className="h-4 w-4" />
                    </Button>
                  )}
                  
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

      {/* Dialog Tambah Film */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah ke Curated</DialogTitle>
          </DialogHeader>
          
          {selectedMovie && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="h-24 w-16 overflow-hidden rounded bg-muted">
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
                    {selectedMovie.media_type || (selectedMovie.title ? "Movie" : "TV")}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Stream URL (Embed/Iframe)</label>
                <Input
                  type="text"
                  placeholder="https://vaplayer.ru/embed/movie/12345"
                  value={streamUrl}
                  onChange={(e) => setStreamUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Masukkan URL embed langsung (tanpa perlu scrape)
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Quality</label>
                <select 
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={quality}
                  onChange={(e) => setQuality(e.target.value)}
                >
                  <option value="CAM">CAM</option>
                  <option value="HD">HD</option>
                  <option value="WEB-DL">WEB-DL</option>
                  <option value="4K">4K</option>
                </select>
              </div>

              <Button className="w-full" onClick={handleSave}>
                Approve & Save
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Footer />
    </main>
  );
}
