"use client";

export const dynamic = "force-dynamic"; // Nonaktifkan SSG untuk halaman ini

import { useEffect, useState } from "react";
import { Header } from "@/components/cinepro/header";
import { Footer } from "@/components/cinepro/footer";
import { SearchModal } from "@/components/cinepro/search-modal";
import { DetailModal } from "@/components/cinepro/detail-modal";
import { PlayerModal } from "@/components/cinepro/player-modal";
import { AuthModal } from "@/components/cinepro/auth-modal";
import { MovieCard } from "@/components/cinepro/movie-card";
import { Loader2 } from "lucide-react";

export default function HistoryPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/history")
      .then((res) => res.json())
      .then((data) => {
        setItems(data.history || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 py-8 pt-24">
        <h1 className="mb-6 text-2xl font-bold sm:text-3xl">Riwayat Tonton</h1>
        
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground">Riwayat tontonan masih kosong.</p>
            <p className="mt-2 text-sm text-muted-foreground">Tonton film apa saja untuk mengisi riwayat ini.</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
            {items.map((item) => (
              <MovieCard
                key={item.id}
                movie={{
                  id: item.mediaId,
                  title: item.title,
                  name: item.title,
                  poster_path: item.posterPath,
                  backdrop_path: item.backdropPath,
                  media_type: item.mediaType,
                }}
              />
            ))}
          </div>
        )}
      </div>

      <Footer />
      <SearchModal />
      <DetailModal />
      <PlayerModal />
      <AuthModal />
    </main>
  );
}
