"use client";

import { useEffect, useState } from "react";
import { useSafeSession } from "@/lib/use-safe-session";
import {
  Play, X, Star, Calendar, Loader2, Bookmark, Check, Share2,
  MessageSquare, Send, Trash2, CornerDownRight, ChevronLeft, ChevronRight,
  Film,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BadgeLabel } from "@/components/badge/badge-label";
import { getAvatarRingClass } from "@/components/badge/avatar-ring";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAppStore } from "@/lib/store";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const VPS_API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "https://api.cinestream.my.id";

// ============================================================
// Types
// ============================================================
interface VPSContent {
  id: number;
  cinemacity_id: string;
  slug: string;
  title: string;
  type: string;
  poster_url: string | null;
  description: string | null;
  rating: number | null;
  release_year: number | null;
  quality: string | null;
  stream_data: any[] | null;
}

interface Episode {
  season: number;
  episode: number;
  title: string;
}

interface UserRating { id: string; rating: number; review: string | null; }
interface RatingItem { id: string; rating: number; review: string | null; createdAt: string; userId: string; name: string | null; image: string | null; }
interface CommentItem { id: string; userId: string; mediaId: number; mediaType: string; content: string; parentId: string | null; createdAt: string; updatedAt: string; userName: string | null; userImage: string | null; replies: CommentItem[]; }

// ============================================================
// Fetch VPS Content Detail
// ============================================================
async function fetchVPSContent(cinemacityId: string): Promise<VPSContent | null> {
  try {
    const res = await fetch(`${VPS_API_BASE}/api/content/${cinemacityId}`);
    const data = await res.json();
    return data.data || null;
  } catch (e) {
    console.error("[Detail] Fetch VPS error:", e);
    return null;
  }
}

// ============================================================
// Parse episodes from stream_data
// ============================================================
function parseEpisodes(streamData: any[] | null): Episode[] {
  if (!streamData || !Array.isArray(streamData)) return [];
  const episodes: Episode[] = [];
  for (const season of streamData) {
    const seasonNum = parseInt(String(season.title || "").match(/\d+/)?.[0] || "1");
    if (season.folder && Array.isArray(season.folder)) {
      for (const ep of season.folder) {
        const epNum = parseInt(String(ep.title || "").match(/\d+/)?.[0] || "1");
        episodes.push({
          season: seasonNum,
          episode: epNum,
          title: ep.title || `Episode ${epNum}`,
        });
      }
    }
  }
  return episodes;
}

// ============================================================
// Detail Modal Component
// ============================================================
export function DetailModal() {
  const { selectedMedia, setSelectedMedia, openPlayer, addToHistory, setAuthModalOpen } = useAppStore();
  const { data: session, status } = useSafeSession();

  const [content, setContent] = useState<VPSContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inWatchlist, setInWatchlist] = useState(false);
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  const [ratings, setRatings] = useState<RatingItem[]>([]);
  const [userRating, setUserRating] = useState<UserRating | null>(null);
  const [hoverRating, setHoverRating] = useState(0);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentText, setCommentText] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [season, setSeason] = useState(1);
  const [episode, setEpisode] = useState(1);

  // ============================================================
  // Load Detail from VPS API
  // ============================================================
  useEffect(() => {
    if (!selectedMedia) {
      Promise.resolve().then(() => {
        setContent(null); setError(null); setInWatchlist(false);
        setRatings([]); setUserRating(null); setComments([]);
        setReplyTo(null); setReplyText(""); setCommentText("");
        setSeason(1); setEpisode(1);
      });
      return;
    }

    let cancelled = false;

    const loadDetail = async () => {
      setLoading(true);
      setError(null);

      try {
const cinemacityId = String(
  (selectedMedia as any).cinemacityId ||
  (selectedMedia as any).cinemacity_id ||
  selectedMedia.id
);

        if (!cinemacityId) {
          throw new Error("No content ID");
        }

        const data = await fetchVPSContent(String(cinemacityId));
        if (cancelled) return;
        if (!data) throw new Error("Failed to load detail");

        setContent(data);

        // Set initial season/episode
        const eps = parseEpisodes(data.stream_data);
        if (eps.length > 0) {
          const startSeason = (selectedMedia as any)._currentSeason
            ? parseInt((selectedMedia as any)._currentSeason)
            : eps[0].season;
          const startEpisode = (selectedMedia as any)._currentEpisode
            ? parseInt((selectedMedia as any)._currentEpisode)
            : eps[0].episode;
          setSeason(startSeason);
          setEpisode(startEpisode);
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadDetail();

    // Fetch user data (watchlist, ratings, comments)
    const mediaId = selectedMedia.id;
    const mediaType = selectedMedia.type;

    if (status === "authenticated" && session?.user) {
      fetch("/api/watchlist")
        .then((res) => res.json())
        .then((data) => {
          if (cancelled) return;
          const exists = data.watchlist?.some(
            (item: any) => item.mediaId == mediaId && item.mediaType === mediaType
          );
          setInWatchlist(!!exists);
        })
        .catch(() => {});
    }

    fetch(`/api/ratings?mediaId=${mediaId}&mediaType=${mediaType}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setRatings(data.ratings || []);
        setUserRating(data.userRating || null);
      })
      .catch(() => {});

    fetch(`/api/comments?mediaId=${mediaId}&mediaType=${mediaType}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setComments(data.comments || []);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [selectedMedia, session, status]);

  // ============================================================
  // Handle Play
  // ============================================================
  const handlePlay = (epNum?: number) => {
    if (!selectedMedia || !content) return;
    const ep = epNum || episode;
    if (epNum) setEpisode(epNum);

    const enrichedMedia = {
      ...selectedMedia,
      cinemacityId: content.cinemacity_id,
      slug: content.slug,
      title: content.title,
      type: content.type === "tv" ? "tv" : "movie",
      poster: content.poster_url || (selectedMedia as any).poster,
      backdrop: content.poster_url || (selectedMedia as any).backdrop,
      overview: content.description || "",
      ...(content.type === "tv"
        ? { _currentSeason: String(season), _currentEpisode: String(ep) }
        : {}),
    };

    addToHistory({ ...enrichedMedia, watchedAt: new Date().toISOString() });
    openPlayer(enrichedMedia, season, ep);
  };

  // ============================================================
  // Watchlist
  // ============================================================
  const handleToggleWatchlist = async () => {
    if (!selectedMedia || !content) return;
    if (status !== "authenticated" || !session?.user) {
      setAuthModalOpen(true);
      toast.info("Silakan login dulu");
      return;
    }
    setWatchlistLoading(true);
    try {
      if (inWatchlist) {
        const listRes = await fetch("/api/watchlist");
        const listData = await listRes.json();
        const item = listData.watchlist?.find(
          (i: any) =>
            i.mediaId == selectedMedia.id &&
            i.mediaType === selectedMedia.type
        );
        if (item) {
          await fetch(`/api/watchlist?id=${item.id}`, { method: "DELETE" });
          setInWatchlist(false);
          toast.success("Dihapus dari watchlist");
        }
      } else {
        const res = await fetch("/api/watchlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mediaId: selectedMedia.id,
            mediaType: selectedMedia.type,
            title: content.title,
            posterPath: content.poster_url,
            backdropPath: content.poster_url,
          }),
        });
        if (res.ok) {
          setInWatchlist(true);
          toast.success("Ditambahkan ke watchlist");
        }
      }
    } catch {
      toast.error("Terjadi kesalahan");
    } finally {
      setWatchlistLoading(false);
    }
  };

  // ============================================================
  // Rate
  // ============================================================
  const handleRate = async (value: number) => {
    if (!selectedMedia) return;
    if (status !== "authenticated") {
      setAuthModalOpen(true);
      toast.info("Silakan login dulu");
      return;
    }
    setRatingLoading(true);
    try {
      const res = await fetch("/api/ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mediaId: selectedMedia.id,
          mediaType: selectedMedia.type,
          rating: value,
        }),
      });
      if (res.ok) {
        toast.success(value === 0 ? "Rating dihapus" : "Rating disimpan!");
        const refresh = await fetch(
          `/api/ratings?mediaId=${selectedMedia.id}&mediaType=${selectedMedia.type}`
        );
        const data = await refresh.json();
        setRatings(data.ratings || []);
        setUserRating(data.userRating || null);
      }
    } catch {
      toast.error("Gagal menyimpan rating");
    } finally {
      setRatingLoading(false);
    }
  };

  // ============================================================
  // Comments
  // ============================================================
  const handlePostComment = async () => {
    if (!selectedMedia || !commentText.trim()) return;
    if (status !== "authenticated") {
      setAuthModalOpen(true);
      return;
    }
    setCommentLoading(true);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mediaId: selectedMedia.id,
          mediaType: selectedMedia.type,
          content: commentText,
        }),
      });
      if (res.ok) {
        setCommentText("");
        toast.success("Komentar ditambahkan");
        const refresh = await fetch(
          `/api/comments?mediaId=${selectedMedia.id}&mediaType=${selectedMedia.type}`
        );
        const data = await refresh.json();
        setComments(data.comments || []);
      }
    } catch {
      toast.error("Gagal menambahkan komentar");
    } finally {
      setCommentLoading(false);
    }
  };

  const handlePostReply = async (parentId: string) => {
    if (!selectedMedia || !replyText.trim()) return;
    setCommentLoading(true);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mediaId: selectedMedia.id,
          mediaType: selectedMedia.type,
          content: replyText,
          parentId,
        }),
      });
      if (res.ok) {
        setReplyText("");
        setReplyTo(null);
        toast.success("Reply ditambahkan");
        const refresh = await fetch(
          `/api/comments?mediaId=${selectedMedia.id}&mediaType=${selectedMedia.type}`
        );
        const data = await refresh.json();
        setComments(data.comments || []);
      }
    } catch {
      toast.error("Gagal menambahkan reply");
    } finally {
      setCommentLoading(false);
    }
  };

  const handleDeleteComment = async (id: string) => {
    try {
      const res = await fetch(`/api/comments?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Komentar dihapus");
        setComments((prev) => prev.filter((c) => c.id !== id));
      }
    } catch {
      toast.error("Gagal menghapus");
    }
  };

  const handleShare = () => {
    if (!selectedMedia || !content) return;
    const shareUrl = `${window.location.origin}/?${selectedMedia.type}=${selectedMedia.id}`;
    const shareTitle = content.title || "CineStream";
    if (navigator.share) {
      navigator
        .share({
          title: shareTitle,
          text: `Tonton ${shareTitle} di CineStream!`,
          url: shareUrl,
        })
        .catch(() => {});
    } else {
      navigator.clipboard.writeText(shareUrl);
      toast.success("Link disalin ke clipboard!");
    }
  };

  if (!selectedMedia) return null;

  // ============================================================
  // Derived
  // ============================================================
  const title = content?.title || selectedMedia.title;
  const year = content?.release_year ? String(content.release_year) : "";
  const rating = content?.rating?.toFixed(1) || "N/A";
  const overview = content?.description || "No overview available.";
  const poster = content?.poster_url || (selectedMedia as any).poster;
  const isTV = (content?.type || selectedMedia.type) === "tv";

  const allEpisodes = parseEpisodes(content?.stream_data || null);
  const seasons = Array.from(
    new Set(allEpisodes.map((e) => e.season))
  ).sort((a, b) => a - b);
  const currentSeasonEpisodes = allEpisodes.filter((e) => e.season === season);
  const avgUserRating =
    ratings.length > 0
      ? (ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length).toFixed(1)
      : null;

  return (
    <>
      <Dialog
        open={!!selectedMedia}
        onOpenChange={(open) => {
          if (!open) setSelectedMedia(null);
        }}
      >
        <DialogContent
          className="flex flex-col gap-0 overflow-hidden p-0 max-w-[95vw] sm:max-w-2xl md:max-w-4xl lg:max-w-6xl"
          style={{
            height: "calc(100dvh - 2rem)",
            maxHeight:
              "calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 1rem)",
            marginTop: "env(safe-area-inset-top)",
            marginBottom: "env(safe-area-inset-bottom)",
            borderRadius: "12px",
          }}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>

          <button
            onClick={() => setSelectedMedia(null)}
            className="absolute right-3 top-3 z-50 flex h-9 w-9 items-center justify-center rounded-full bg-black/80 text-white backdrop-blur-sm transition-colors hover:bg-primary"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            {loading ? (
              <div className="flex h-96 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : error ? (
              <div className="flex h-96 flex-col items-center justify-center gap-3 p-6 text-center">
                <p className="text-sm text-destructive">{error}</p>
                <Button variant="secondary" size="sm" onClick={() => setSelectedMedia(null)}>
                  Go back
                </Button>
              </div>
            ) : content ? (
              <div className="fade-in pb-16">
                {/* === Hero Section === */}
                <div className="relative h-[22vh] min-h-[140px] w-full overflow-hidden bg-muted sm:h-[30vh] md:aspect-video md:h-auto">
                  {poster && (
                    <img
                      src={poster}
                      alt={title}
                      className="h-full w-full object-cover"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-card via-card/30 to-transparent" />
                  <div className="absolute inset-0 bg-gradient-to-r from-card/80 via-transparent to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-3 pr-12 sm:p-6 md:p-8">
                    <Badge className="mb-1 bg-primary text-primary-foreground sm:mb-2">
                      {isTV ? "TV Series" : "Movie"}
                    </Badge>
                    {content.quality && (
                      <Badge className="mb-1 ml-1 bg-secondary text-secondary-foreground sm:mb-2">
                        {content.quality}
                      </Badge>
                    )}
                    <h2 className="text-lg font-extrabold tracking-tight text-white drop-shadow-lg sm:text-2xl md:text-4xl">
                      {title}
                    </h2>
                  </div>
                </div>

                {/* === Action bar === */}
                <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card/50 px-4 py-3 sm:gap-3 sm:px-6 md:px-8">
                  <Button
                    size="sm"
                    onClick={() => handlePlay()}
                    className="gap-2 bg-red-600 text-white hover:bg-red-700 sm:size-lg"
                  >
                    <Play className="h-4 w-4 fill-current" />
                    <span className="text-xs sm:text-sm">Play</span>
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={handleToggleWatchlist}
                    disabled={watchlistLoading}
                    className={inWatchlist ? "border-primary text-primary" : ""}
                  >
                    {watchlistLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : inWatchlist ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Bookmark className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    aria-label="Share"
                    onClick={handleShare}
                  >
                    <Share2 className="h-4 w-4" />
                  </Button>
                </div>

                {/* === Season/Episode selector (TV only) === */}
                {isTV && seasons.length > 0 && (
                  <div className="border-b border-border bg-card/30 px-4 py-3 sm:px-6 md:px-8">
                    <div className="mb-3 flex items-center gap-2">
                      {seasons.length > 1 && (
                        <Select
                          value={String(season)}
                          onValueChange={(v) => {
                            setSeason(parseInt(v, 10));
                            setEpisode(1);
                          }}
                        >
                          <SelectTrigger className="h-8 w-28 shrink-0 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {seasons.map((s) => (
                              <SelectItem key={s} value={String(s)}>
                                S{s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      <span className="ml-auto text-[10px] text-muted-foreground">
                        EP {episode}
                      </span>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          disabled={episode <= 1}
                          onClick={() => setEpisode(Math.max(1, episode - 1))}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => setEpisode(episode + 1)}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {currentSeasonEpisodes.length > 0 ? (
                      <div
                        className="overflow-x-auto pb-1"
                        style={{
                          scrollbarWidth: "none",
                          WebkitOverflowScrolling: "touch",
                        }}
                      >
                        <div className="flex flex-wrap gap-2">
                          {currentSeasonEpisodes.map((ep) => (
                            <button
                              key={ep.episode}
                              onClick={() => handlePlay(ep.episode)}
                              className={`flex h-8 w-8 items-center justify-center rounded-md text-[10px] font-bold transition-all sm:h-10 sm:w-10 sm:text-xs ${
                                episode === ep.episode
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted text-muted-foreground hover:bg-muted/80"
                              }`}
                            >
                              {ep.episode}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="flex h-16 items-center justify-center text-xs text-muted-foreground">
                        Tidak ada episode di season ini
                      </div>
                    )}
                  </div>
                )}

                {/* === Content grid === */}
                <div className="grid gap-4 p-4 sm:gap-6 sm:p-6 md:grid-cols-3 md:p-8">
                  <div className="min-w-0 md:col-span-2">
                    {/* Meta info */}
                    <div className="mb-3 flex flex-wrap items-center gap-2 text-xs sm:mb-4 sm:gap-3 sm:text-sm">
                      <span className="flex items-center gap-1">
                        <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400 sm:h-4 sm:w-4" />
                        <span className="font-semibold">{rating}</span>
                      </span>
                      {avgUserRating && (
                        <span className="flex items-center gap-1 text-primary">
                          <Star className="h-3.5 w-3.5 fill-primary text-primary sm:h-4 sm:w-4" />
                          <span className="font-semibold">{avgUserRating}</span>
                          <span className="text-muted-foreground">User</span>
                        </span>
                      )}
                      {year && (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          {year}
                        </span>
                      )}
                      {content.quality && (
                        <Badge variant="secondary" className="text-xs">
                          {content.quality}
                        </Badge>
                      )}
                    </div>

                    {/* Overview */}
                    <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:mb-2 sm:text-sm">
                      Overview
                    </h3>
                    <p className="break-words text-xs leading-relaxed text-foreground/90 sm:text-sm md:text-base">
                      {overview}
                    </p>

                    {/* Rate This */}
                    <div className="mt-6 border-t border-border pt-4">
                      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:text-sm">
                        Rate This {isTV ? "Series" : "Movie"}
                      </h3>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => {
                          const value = star * 2;
                          const isActive =
                            (hoverRating || userRating?.rating || 0) >= value;
                          return (
                            <button
                              key={star}
                              onClick={() => handleRate(value)}
                              onMouseEnter={() => setHoverRating(value)}
                              onMouseLeave={() => setHoverRating(0)}
                              disabled={ratingLoading}
                              className="transition-transform hover:scale-110 disabled:opacity-50"
                            >
                              <Star
                                className={
                                  isActive
                                    ? "h-6 w-6 fill-yellow-400 text-yellow-400 sm:h-7 sm:w-7"
                                    : "h-6 w-6 text-muted-foreground sm:h-7 sm:w-7"
                                }
                              />
                            </button>
                          );
                        })}
                        <span className="ml-3 text-sm font-medium">
                          {ratingLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : userRating ? (
                            <span className="text-primary">{userRating.rating}/10</span>
                          ) : (
                            <span className="text-muted-foreground">Click to rate</span>
                          )}
                        </span>
                      </div>
                      {userRating && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRate(0)}
                          className="mt-2 text-xs text-muted-foreground hover:text-destructive"
                        >
                          Hapus rating
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Right sidebar info */}
                  <div className="min-w-0 space-y-3 sm:space-y-4">
                    {isTV && seasons.length > 0 && (
                      <div className="flex gap-4">
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Seasons
                          </h4>
                          <p className="mt-0.5 text-xs sm:text-sm">{seasons.length}</p>
                        </div>
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Episodes
                          </h4>
                          <p className="mt-0.5 text-xs sm:text-sm">{allEpisodes.length}</p>
                        </div>
                      </div>
                    )}
                    {content.quality && (
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Quality
                        </h4>
                        <p className="mt-0.5 text-xs sm:text-sm">{content.quality}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Comments */}
                <div className="border-t border-border px-4 py-4 pb-12 sm:px-6 sm:py-6 md:px-8">
                  <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:text-sm">
                    <MessageSquare className="h-4 w-4" />
                    Comments ({comments.length})
                  </h3>
                  <div className="mb-4 flex gap-2">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarImage src={session?.user?.image || undefined} />
                      <AvatarFallback className="bg-primary/20 text-xs text-primary">
                        {session?.user?.name?.[0]?.toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <textarea
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder={
                          status === "authenticated"
                            ? "Tulis komentar..."
                            : "Login untuk berkomentar"
                        }
                        disabled={status !== "authenticated"}
                        className="w-full resize-none rounded-lg border border-border bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-primary disabled:opacity-50"
                        rows={2}
                        maxLength={2000}
                      />
                      {status === "authenticated" && (
                        <Button
                          size="sm"
                          onClick={handlePostComment}
                          disabled={!commentText.trim() || commentLoading}
                          className="mt-2 gap-1.5"
                        >
                          {commentLoading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Send className="h-3.5 w-3.5" />
                          )}
                          Post
                        </Button>
                      )}
                    </div>
                  </div>
                  <div
                    className="max-h-[300px] space-y-3 overflow-y-auto pr-1"
                    style={{ scrollbarWidth: "thin", WebkitOverflowScrolling: "touch" }}
                  >
                    {comments.length === 0 ? (
                      <p className="py-4 text-center text-xs text-muted-foreground">
                        Belum ada komentar. Jadilah yang pertama!
                      </p>
                    ) : (
                      comments.map((c) => (
                        <CommentNode
                          key={c.id}
                          comment={c}
                          currentUserId={session?.user?.id}
                          onReply={(id: string) => {
                            setReplyTo(id);
                            setReplyText("");
                          }}
                          replyTo={replyTo}
                          replyText={replyText}
                          setReplyText={setReplyText}
                          onPostReply={handlePostReply}
                          onDelete={handleDeleteComment}
                          commentLoading={commentLoading}
                          level={0}
                        />
                      ))
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ============================================================
// Comment Node Component
// ============================================================
function CommentNode({
  comment,
  currentUserId,
  onReply,
  replyTo,
  replyText,
  setReplyText,
  onPostReply,
  onDelete,
  commentLoading,
  level,
}: any) {
  const initial = comment.userName?.[0]?.toUpperCase() || "U";
  const timeAgo = new Date(comment.createdAt).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const isOwner = currentUserId === comment.userId;
  const badge = comment.userBadge;

  return (
    <div className={level > 0 ? "ml-6 border-l border-border pl-3" : ""}>
      <div className="flex gap-2">
        <Avatar className={cn("h-8 w-8 shrink-0", getAvatarRingClass(badge?.slug))}>
          <AvatarImage src={comment.userImage || undefined} />
          <AvatarFallback className="bg-primary/20 text-xs text-primary">
            {initial}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="rounded-lg bg-muted/40 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold">
                  {comment.userName || "Anonymous"}
                </span>
                {badge && <BadgeLabel slug={badge.slug} name={badge.name} size={10} />}
              </div>
              <span className="text-[10px] text-muted-foreground">{timeAgo}</span>
            </div>
            <p className="mt-1 break-words text-xs leading-relaxed sm:text-sm">
              {comment.content}
            </p>
          </div>
          <div className="mt-1 flex items-center gap-3 px-1">
            <button
              onClick={() => onReply(comment.id)}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary"
            >
              <CornerDownRight className="h-3 w-3" />
              Reply
            </button>
            {isOwner && (
              <button
                onClick={() => onDelete(comment.id)}
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
                Delete
              </button>
            )}
          </div>
          {replyTo === comment.id && (
            <div className="mt-2 flex gap-2">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder={`Reply to ${comment.userName || "user"}...`}
                className="flex-1 resize-none rounded-lg border border-border bg-transparent px-3 py-2 text-xs outline-none focus:border-primary"
                rows={2}
                maxLength={2000}
                autoFocus
              />
              <Button
                size="sm"
                onClick={() => onPostReply(comment.id)}
                disabled={!replyText.trim() || commentLoading}
                className="gap-1 self-end"
              >
                {commentLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Send className="h-3 w-3" />
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-3 space-y-3">
          {comment.replies.map((r: any) => (
            <CommentNode
              key={r.id}
              comment={r}
              currentUserId={currentUserId}
              onReply={onReply}
              replyTo={replyTo}
              replyText={replyText}
              setReplyText={setReplyText}
              onPostReply={onPostReply}
              onDelete={onDelete}
              commentLoading={commentLoading}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
