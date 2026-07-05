"use client";

import { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/cinepro/header";
import { Footer } from "@/components/cinepro/footer";
import { SearchModal } from "@/components/cinepro/search-modal";
import { DetailModal } from "@/components/cinepro/detail-modal";
import { PlayerModal } from "@/components/cinepro/player-modal";
import { AuthModal } from "@/components/cinepro/auth-modal";
import { AnimeCard } from "@/components/anime/anime-card";
import { Loader2, Search, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface AnimeListItem {
  title: string;
  poster?: string;
  episodes?: number | string;
  releaseDay?: string;
  latestReleaseDate?: string;
  animeId: string;
  href: string;
  source?: "otakudesu" | "animasu";
}

type Tab = "home" | "ongoing" | "completed" | "popular" | "movies" | "latest";
type Source = "otakudesu" | "animasu";

export function AnimeContent() {
  const [source, setSource] = useState<Source>("otakudesu");
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [ongoing, setOngoing] = useState<AnimeListItem[]>([]);
  const [completed, setCompleted] = useState<AnimeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<AnimeListItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  // === Load data berdasarkan tab ===
  const loadData = useCallback(
    async (src: Source, tab: Tab, pageNum: number = 1) => {
      setLoading(true);
      setError(null);

      try {
        let endpoint = "";
        if (src === "otakudesu") {
          if (tab === "home") endpoint = "/api/anime/home";
          else if (tab === "ongoing")
            endpoint = `/api/anime/ongoing-anime?page=${pageNum}`;
          else if (tab === "completed")
            endpoint = `/api/anime/complete-anime?page=${pageNum}`;
        } else {
          // Animasu
          if (tab === "home") endpoint = "/api/anime/animasu/home";
          else if (tab === "ongoing")
            endpoint = `/api/anime/animasu/ongoing?page=${pageNum}`;
          else if (tab === "completed")
            endpoint = `/api/anime/animasu/completed?page=${pageNum}`;
          else if (tab === "popular")
            endpoint = `/api/anime/animasu/popular?page=${pageNum}`;
          else if (tab === "movies")
            endpoint = `/api/anime/animasu/movies?page=${pageNum}`;
          else if (tab === "latest")
            endpoint = `/api/anime/animasu/latest?page=${pageNum}`;
        }

        const res = await fetch(endpoint);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();

        // Normalize list dengan source tag
        const normalize = (list: any[] = []) =>
          list.map((item: any) => {
            // Animasu pakai slug, Otakudesu pakai animeId
            const animeId = item.slug || item.animeId;
            return {
              ...item,
              animeId,
              source: src,
            };
          });

        if (src === "otakudesu" && tab === "home") {
          const ongoingList = normalize(json?.data?.ongoing?.animeList || []);
          const completedList = normalize(
            json?.data?.completed?.animeList || []
          );
          setOngoing(ongoingList);
          setCompleted(completedList);
          setHasMore(false);
        } else if (src === "animasu" && tab === "home") {
          // Animasu home return { ongoing: [], recent: [] }
          const ongoingList = normalize(json?.ongoing || []);
          const recentList = normalize(json?.recent || []);
          setOngoing(ongoingList);
          setCompleted(recentList);
          setHasMore(false);
        } else {
          // Animasu return array langsung, Otakudesu return { data: { animeList } }
          const rawList =
            src === "animasu"
              ? Array.isArray(json)
                ? json
                : json?.data?.animeList || []
              : json?.data?.animeList || [];
          const list = normalize(rawList);

          if (pageNum === 1) {
            if (
              tab === "ongoing" ||
              tab === "popular" ||
              tab === "movies" ||
              tab === "latest"
            )
              setOngoing(list);
            else setCompleted(list);
          } else {
            if (
              tab === "ongoing" ||
              tab === "popular" ||
              tab === "movies" ||
              tab === "latest"
            )
              setOngoing((prev) => [...prev, ...list]);
            else setCompleted((prev) => [...prev, ...list]);
          }
          // Heuristic pagination (page size ~15-20)
          setHasMore(list.length >= 15);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load anime");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // === Initial load ===
  useEffect(() => {
    loadData(source, "home");
  }, [loadData, source]);

  // === Tab change ===
  useEffect(() => {
    if (activeTab !== "home") {
      setPage(1);
      loadData(source, activeTab, 1);
    }
  }, [activeTab, source, loadData]);

  // === Handle source change ===
  const handleSourceChange = (newSource: Source) => {
    setSource(newSource);
    setActiveTab("home");
    setPage(1);
    setSearchQuery("");
  };

  // === Search dengan debounce ===
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const searchEndpoint =
          source === "otakudesu"
            ? `/api/anime/search/${encodeURIComponent(searchQuery.trim())}`
            : `/api/anime/animasu/search/${encodeURIComponent(
                searchQuery.trim()
              )}`;

        const res = await fetch(searchEndpoint);
        if (!res.ok) throw new Error("Search failed");
        const json = await res.json();

        // Animasu return array langsung atau di data
        const rawList =
          source === "animasu"
            ? Array.isArray(json)
              ? json
              : json?.data?.animeList || []
            : json?.data?.animeList || [];
        const list = rawList.map((item: any) => ({
          ...item,
          animeId: item.slug || item.animeId,
          source,
        }));
        setSearchResults(list);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery, source]);

  // === Load more ===
  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadData(source, activeTab, nextPage);
  };

  // === Refresh ===
  const handleRefresh = () => {
    setPage(1);
    loadData(source, activeTab === "search" ? "home" : activeTab, 1);
  };

  const showSearch = searchQuery.trim().length > 0;

  return (
    <main className="min-h-screen bg-background">
      <Header />

      <div className="container mx-auto px-4 py-8 pt-24">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold sm:text-3xl">Anime</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tonton anime sub Indo gratis. Update tiap hari.
          </p>
        </div>

        {/* Search bar */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Cari anime... (misal: One Piece, Naruto, Solo Leveling)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
          {searching && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>

        {/* Source selector + Tabs (hidden when searching) */}
        {!showSearch && (
          <>
            {/* Source selector */}
            <div className="mb-4 flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Sumber:</span>
              <div className="flex gap-1 rounded-full bg-muted p-1">
                <button
                  onClick={() => handleSourceChange("otakudesu")}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold transition-all",
                    source === "otakudesu"
                      ? "bg-blue-500 text-white"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Otakudesu
                </button>
                <button
                  onClick={() => handleSourceChange("animasu")}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold transition-all",
                    source === "animasu"
                      ? "bg-purple-500 text-white"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Animasu
                </button>
              </div>

              <button
                onClick={handleRefresh}
                className="ml-auto shrink-0 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Refresh"
              >
                <RefreshCw
                  className={cn("h-4 w-4", loading && "animate-spin")}
                />
              </button>
            </div>

            {/* Tabs */}
            <div className="mb-6 flex items-center gap-2 overflow-x-auto pb-2">
              {(source === "otakudesu"
                ? (["home", "ongoing", "completed"] as Tab[])
                : ([
                    "home",
                    "ongoing",
                    "completed",
                    "popular",
                    "movies",
                    "latest",
                  ] as Tab[])
              ).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                    activeTab === tab
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/70"
                  )}
                >
                  {tab === "home" && "Beranda"}
                  {tab === "ongoing" && "Sedang Tayang"}
                  {tab === "completed" && "Tamat"}
                  {tab === "popular" && "Populer"}
                  {tab === "movies" && "Movie"}
                  {tab === "latest" && "Terbaru"}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Loading state */}
        {loading && !showSearch && (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {/* Error state */}
        {error && !showSearch && (
          <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="secondary" size="sm" onClick={handleRefresh}>
              Coba lagi
            </Button>
          </div>
        )}

        {/* === SEARCH RESULTS === */}
        {showSearch && (
          <section className="mb-8">
            <h2 className="mb-4 text-lg font-bold">
              Hasil pencarian: &quot;{searchQuery}&quot;
            </h2>
            {searching ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : searchResults.length > 0 ? (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
                {searchResults.map((anime) => (
                  <AnimeCard key={anime.animeId} anime={anime} />
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Tidak ada hasil ditemukan.
              </p>
            )}
          </section>
        )}

        {/* === HOME TAB === */}
        {!showSearch && activeTab === "home" && !loading && !error && (
          <>
            {/* Recent / Ongoing */}
            {ongoing.length > 0 && (
              <section className="mb-8">
                <h2 className="mb-4 text-lg font-bold">
                  {source === "animasu" ? "🔥 Rilisan Terbaru" : "🔥 Sedang Tayang"}
                </h2>
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
                  {ongoing.slice(0, 14).map((anime) => (
                    <AnimeCard key={anime.animeId} anime={anime} />
                  ))}
                </div>
              </section>
            )}

            {/* Completed / Recent */}
            {completed.length > 0 && (
              <section className="mb-8">
                <h2 className="mb-4 text-lg font-bold">
                  {source === "animasu" ? "✅ Tamat" : "✅ Tamat"}
                </h2>
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
                  {completed.slice(0, 14).map((anime) => (
                    <AnimeCard key={anime.animeId} anime={anime} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {/* === ONGOING TAB === */}
        {!showSearch && activeTab === "ongoing" && !loading && !error && (
          <section>
            <h2 className="mb-4 text-lg font-bold">Sedang Tayang</h2>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
              {ongoing.map((anime) => (
                <AnimeCard key={anime.animeId} anime={anime} />
              ))}
            </div>
            {hasMore && (
              <div className="mt-6 flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLoadMore}
                  disabled={loading}
                  className="gap-2"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Muat lebih banyak
                </Button>
              </div>
            )}
          </section>
        )}

        {/* === COMPLETED TAB === */}
        {!showSearch && activeTab === "completed" && !loading && !error && (
          <section>
            <h2 className="mb-4 text-lg font-bold">Tamat</h2>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
              {completed.map((anime) => (
                <AnimeCard key={anime.animeId} anime={anime} />
              ))}
            </div>
            {hasMore && (
              <div className="mt-6 flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLoadMore}
                  disabled={loading}
                  className="gap-2"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Muat lebih banyak
                </Button>
              </div>
            )}
          </section>
        )}

        {/* === POPULAR TAB (Animasu only) === */}
        {!showSearch && activeTab === "popular" && !loading && !error && (
          <section>
            <h2 className="mb-4 text-lg font-bold">Anime Populer</h2>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
              {ongoing.map((anime) => (
                <AnimeCard key={anime.animeId} anime={anime} />
              ))}
            </div>
            {hasMore && (
              <div className="mt-6 flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLoadMore}
                  disabled={loading}
                  className="gap-2"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Muat lebih banyak
                </Button>
              </div>
            )}
          </section>
        )}

        {/* === MOVIES TAB (Animasu only) === */}
        {!showSearch && activeTab === "movies" && !loading && !error && (
          <section>
            <h2 className="mb-4 text-lg font-bold">Anime Movie</h2>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
              {ongoing.map((anime) => (
                <AnimeCard key={anime.animeId} anime={anime} />
              ))}
            </div>
            {hasMore && (
              <div className="mt-6 flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLoadMore}
                  disabled={loading}
                  className="gap-2"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Muat lebih banyak
                </Button>
              </div>
            )}
          </section>
        )}

        {/* === LATEST TAB (Animasu only) === */}
        {!showSearch && activeTab === "latest" && !loading && !error && (
          <section>
            <h2 className="mb-4 text-lg font-bold">Anime Terbaru</h2>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
              {ongoing.map((anime) => (
                <AnimeCard key={anime.animeId} anime={anime} />
              ))}
            </div>
            {hasMore && (
              <div className="mt-6 flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLoadMore}
                  disabled={loading}
                  className="gap-2"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Muat lebih banyak
                </Button>
              </div>
            )}
          </section>
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
