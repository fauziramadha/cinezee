"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { X, AlertCircle, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppStore } from "@/lib/store";

// ============================================================
// Types
// ============================================================
interface PlayerMediaSeason {
  seasonNumber: number;
  episodeCount: number;
  name?: string;
}

// ============================================================
// Helpers
// ============================================================
function extractImdbId(media: any): string | null {
  if (!media) return null;
  if (media.imdbId && /^tt\d{6,}$/i.test(media.imdbId)) return media.imdbId;
  if (media.imdb_id && /^tt\d{6,}$/i.test(media.imdb_id)) return media.imdb_id;
  if (typeof media.id === "string" && /^tt\d{6,}$/i.test(media.id)) return media.id;
  return null;
}

function buildEpisodes(seasons: PlayerMediaSeason[]) {
  const eps: { season: string; episode: string; title: string }[] = [];
  const sorted = [...seasons].sort((a, b) => a.seasonNumber - b.seasonNumber);
  sorted.forEach((s) => {
    if (s.seasonNumber === 0) return;
    const count = Math.max(1, Math.min(s.episodeCount || 0, 100));
    for (let i = 1; i <= count; i++) {
      eps.push({
        title: `Episode ${i}`,
        season: String(s.seasonNumber),
        episode: String(i),
      });
    }
  });
  return eps;
}

function buildEmbedUrl(
  imdbId: string,
  type: "movie" | "tv",
  season?: string,
  episode?: string
): string {
  let url: string;
  if (type === "tv" && season && episode) {
    url = `https://vaplayer.ru/embed/tv/${imdbId}/${season}/${episode}`;
  } else {
    url = `https://vaplayer.ru/embed/movie/${imdbId}`;
  }
  // Auto Indonesian subtitle + autoplay
  const params = new URLSearchParams({
    ds_lang: "id",
    autoplay: "1",
  });
  return `${url}?${params.toString()}`;
}

// ============================================================
// PLAYER MODAL
// ============================================================
export function PlayerModal() {
  const { playerMedia, closePlayer, addToHistory, updateHistoryProgress, history } = useAppStore();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [embedUrl, setEmbedUrl] = useState<string>("");
  const [episodes, setEpisodes] = useState<{ season: string; episode: string; title: string }[]>([]);
  const [currentSeason, setCurrentSeason] = useState<string>("");
  const [currentEpisodeIdx, setCurrentEpisodeIdx] = useState<number>(0);

  // ============================================================
  // Init: Build embed URL + episodes list
  // ============================================================
  useEffect(() => {
    if (!playerMedia) {
      setEmbedUrl("");
      setEpisodes([]);
      setError(null);
      setLoading(true);
      return;
    }

    setLoading(true);
    setError(null);

    const imdbId = extractImdbId(playerMedia);
    if (!imdbId) {
      setError("Konten ini tidak memiliki IMDB ID, tidak bisa diputar.");
      setLoading(false);
      return;
    }

    const type: "movie" | "tv" = playerMedia.type === "tv" ? "tv" : "movie";

    if (type === "tv") {
      // Build episodes dari seasons metadata
      const mediaSeasons: PlayerMediaSeason[] =
        (playerMedia as any).seasons || (playerMedia as any).tv_seasons || [];
      const validSeasons = mediaSeasons.filter(
        (s) => s && typeof s.seasonNumber === "number" && s.episodeCount > 0
      );

      let eps = validSeasons.length > 0 ? buildEpisodes(validSeasons) : [];

      // Kalau ada _currentSeason/_currentEpisode (dari episode terbaru), langsung pakai
      const startSeason = (playerMedia as any)._currentSeason;
      const startEpisode = (playerMedia as any)._currentEpisode;

      if (startSeason && startEpisode) {
        // Cari atau tambahkan episode ini di list
        const existing = eps.findIndex(
          (e) => e.season === startSeason && e.episode === startEpisode
        );
        if (existing >= 0) {
          setCurrentEpisodeIdx(existing);
        } else {
          // Tambahkan di depan
          eps = [{ season: startSeason, episode: startEpisode, title: `Episode ${startEpisode}` }, ...eps];
          setCurrentEpisodeIdx(0);
        }
      } else if (eps.length > 0) {
        setCurrentEpisodeIdx(0);
      }

      setEpisodes(eps);
      setCurrentSeason(startSeason || eps[0]?.season || "1");

      // Build embed URL
      const season = startSeason || eps[0]?.season || "1";
      const episode = startEpisode || eps[0]?.episode || "1";
      setEmbedUrl(buildEmbedUrl(imdbId, "tv", season, episode));
    } else {
      setEpisodes([]);
      setEmbedUrl(buildEmbedUrl(imdbId, "movie"));
    }

    // Add to history
    const existing = history.find((h) => h.id === playerMedia.id);
    if (!existing) {
      addToHistory({ ...playerMedia, watchedAt: new Date().toISOString() });
    }

    setLoading(false);
  }, [playerMedia]);

  // ============================================================
  // Episode Change
  // ============================================================
  const handleEpisodeChange = (idx: number) => {
    const ep = currentSeasonEpisodes[idx];
    if (!ep) return;

    setCurrentEpisodeIdx(idx);

    const imdbId = extractImdbId(playerMedia);
    if (!imdbId) return;

    setLoading(true);
    setEmbedUrl(buildEmbedUrl(imdbId, "tv", ep.season, ep.episode));
    setTimeout(() => setLoading(false), 1500);
  };

  // ============================================================
  // Season Change
  // ============================================================
  const handleSeasonChange = (season: string) => {
    setCurrentSeason(season);
    const firstEp = episodes.find((e) => (e.season || "1") === season);
    if (firstEp) {
      const idx = episodes.findIndex(
        (e) => (e.season || "1") === season && e.episode === firstEp.episode
      );
      if (idx >= 0) handleEpisodeChange(idx);
    }
  };

  // ============================================================
  // Progress Tracking via postMessage
  // ============================================================
  useEffect(() => {
    if (!playerMedia || !embedUrl) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type !== "PLAYER_EVENT") return;

      const { player_status, player_progress, player_duration, player_info } = event.data.data || {};

      // Save progress setiap 5 detik saat playing
      if (player_status === "playing" && player_progress && player_duration) {
        const progress = parseFloat(player_progress);
        const duration = parseFloat(player_duration);
        if (progress > 0 && duration > 0) {
          updateHistoryProgress(playerMedia.id, progress, duration);
        }
      }

      // Save progress saat paused
      if (player_status === "paused" && player_progress) {
        updateHistoryProgress(playerMedia.id, parseFloat(player_progress), parseFloat(player_duration) || 0);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [playerMedia, embedUrl, updateHistoryProgress]);

  // ============================================================
  // Derived
  // ============================================================
  const seasons = useMemo(() => {
    const set = new Set<string>();
    episodes.forEach((e) => set.add(e.season || "1"));
    return Array.from(set).sort((a, b) => Number(a) - Number(b));
  }, [episodes]);

  const currentSeasonEpisodes = useMemo(() => {
    return episodes.filter((e) => (e.season || "1") === currentSeason);
  }, [episodes, currentSeason]);

  if (!playerMedia) return null;

  const isTV = playerMedia.type === "tv" && episodes.length > 0;

  return (
    <Dialog open={!!playerMedia} onOpenChange={(open) => !open && closePlayer()}>
      <DialogContent className="max-w-[95vw] overflow-hidden rounded-xl border-0 bg-black p-0 md:max-w-5xl">
        <DialogTitle className="sr-only">{playerMedia.title}</DialogTitle>

        <button
          onClick={closePlayer}
          className="absolute right-2 top-2 z-30 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white opacity-0 backdrop-blur-sm transition-all hover:bg-red-600 hover:opacity-100 focus:opacity-100"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {loading && (
          <div className="flex aspect-video items-center justify-center bg-black">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm text-white/70">Loading stream...</p>
            </div>
          </div>
        )}

        {error && !loading && (
          <div className="flex aspect-video flex-col items-center justify-center gap-3 bg-black p-6 text-center">
            <AlertCircle className="h-10 w-10 text-red-500" />
            <p className="text-sm text-white/90">{error}</p>
            <Button variant="secondary" size="sm" onClick={closePlayer}>
              Close
            </Button>
          </div>
        )}

        {!loading && !error && embedUrl && (
          <div className="relative aspect-video w-full bg-black">
            <iframe
              src={embedUrl}
              className="h-full w-full"
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        )}

        {/* TV Episode Controls */}
        {!loading && !error && embedUrl && isTV && (
          <div className="flex flex-wrap items-center gap-2 border-t border-white/10 bg-zinc-950 p-3">
            {seasons.length > 1 && (
              <Select value={currentSeason} onValueChange={handleSeasonChange}>
                <SelectTrigger className="h-8 w-24 shrink-0 border-white/20 bg-zinc-900 text-xs text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {seasons.map((s) => (
                    <SelectItem key={s} value={s} className="text-xs">
                      Season {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {seasons.length === 1 && (
              <span className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white/80">
                Season {currentSeason}
              </span>
            )}

            <Select
              value={String(currentEpisodeIdx)}
              onValueChange={(v) => handleEpisodeChange(Number(v))}
            >
              <SelectTrigger className="h-8 w-40 shrink-0 border-white/20 bg-zinc-900 text-xs text-white sm:w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currentSeasonEpisodes.map((ep, idx) => (
                  <SelectItem key={idx} value={String(idx)} className="text-xs">
                    E{ep.episode} — {ep.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <span className="ml-auto text-[10px] text-white/50">
              {currentEpisodeIdx + 1} / {currentSeasonEpisodes.length}
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => currentEpisodeIdx > 0 && handleEpisodeChange(currentEpisodeIdx - 1)}
                disabled={currentEpisodeIdx === 0}
                className="flex h-8 items-center justify-center rounded-md bg-zinc-900 px-3 text-xs text-white/80 transition-colors hover:bg-zinc-800 disabled:opacity-30"
              >
                ← Prev
              </button>
              <button
                onClick={() =>
                  currentEpisodeIdx < currentSeasonEpisodes.length - 1 &&
                  handleEpisodeChange(currentEpisodeIdx + 1)
                }
                disabled={currentEpisodeIdx === currentSeasonEpisodes.length - 1}
                className="flex h-8 items-center justify-center rounded-md bg-zinc-900 px-3 text-xs text-white/80 transition-colors hover:bg-zinc-800 disabled:opacity-30"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
