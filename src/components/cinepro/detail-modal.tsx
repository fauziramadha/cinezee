"use client";

import { useEffect, useState, useMemo } from "react";
import { useSafeSession } from "@/lib/use-safe-session";
import { Loader2, Star, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";
import { toast } from "sonner";

import {
  fetchVPSContent,
  parseEpisodes,
  type VPSContent,
  type RecommendationItem,
} from "./detail/types";
import { DetailHero } from "./detail/detail-hero";
import { DetailInfo } from "./detail/detail-info";
import { DetailRecommendations } from "./detail/detail-recommendations";
import { DetailComments } from "./detail/detail-comments";
import { DetailTrailerModal } from "./detail/detail-trailer-modal";

export function DetailModal() {
  const { selectedMedia, setSelectedMedia, openPlayer, addToHistory, setAuthModalOpen } =
    useAppStore();
  const { data: session, status } = useSafeSession();

  const [content, setContent] = useState<VPSContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Watchlist
  const [inWatchlist, setInWatchlist] = useState(false);
  const [watchlistLoading, setWatchlistLoading] = useState(false);

  // Ratings
  const [ratings, setRatings] = useState<any[]>([]);
  const [userRating, setUserRating] = useState<any>(null);
  const [hoverRating, setHoverRating] = useState(0);
  const [ratingLoading, setRatingLoading] = useState(false);

  // Comments
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  // Episode
  const [season, setSeason] = useState(1);
  const [episode, setEpisode] = useState(1);

  // Trailer modal
  const [trailerOpen, setTrailerOpen] = useState(false);

  // ============================================================
  // Load Detail
  // ============================================================
  useEffect(() => {
    if (!selectedMedia) {
      Promise.resolve().then(() => {
        setContent(null);
        setError(null);
        setInWatchlist(false);
        setRatings([]);
        setUserRating(null);
        setComments([]);
        setReplyTo(null);
        setReplyText("");
        setCommentText("");
        setSeason(1);
        setEpisode(1);
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

        const slug = (selectedMedia as any).slug || "";
        const type = (selectedMedia as any).type || "movie";
        const data = await fetchVPSContent(String(cinemacityId), slug, type);
        if (cancelled) return;
        if (!data) throw new Error("Failed to load detail");

        setContent(data);

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
  // Handlers
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
      rating: content.rating ? parseFloat(String(content.rating)) : 0,
      ...(content.type === "tv"
        ? { _currentSeason: String(season), _currentEpisode: String(ep) }
        : {}),
    };

    addToHistory({ ...enrichedMedia, watchedAt: new Date().toISOString() });
    openPlayer(enrichedMedia, season, ep);
  };

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
            i.mediaId == selectedMedia.id && i.mediaType === selectedMedia.type
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

  const handleRecommendationClick = (item: RecommendationItem) => {
    setSelectedMedia({
      id: item.cinemacity_id,
      cinemacityId: item.cinemacity_id,
      slug: item.slug,
      title: item.title,
      type: "movie",
      poster: item.poster_url,
      backdrop: item.poster_url,
      overview: "",
      year: String(item.release_year),
      rating: item.rating,
    } as any);
  };

  // ============================================================
  // Guard awal — cegah crash saat selectedMedia null
  // ============================================================
  if (!selectedMedia) return null;

  // ============================================================
  // Derived (aman diakses karena selectedMedia sudah pasti tidak null)
  // ============================================================
  const title = content?.title || selectedMedia.title;
  const year = content?.release_year ? String(content.release_year) : "";
  const ratingNum = content?.rating ? parseFloat(String(content.rating)) : 0;
  const rating = ratingNum > 0 ? ratingNum.toFixed(1) : "N/A";
  const overview = content?.description || "No overview available.";
  const isTV = (content?.type || selectedMedia.type) === "tv";

  const allEpisodes = useMemo(
    () => parseEpisodes(content?.stream_data || null),
    [content?.stream_data]
  );
  const seasons = useMemo(
    () => Array.from(new Set(allEpisodes.map((e) => e.season))).sort((a, b) => a - b),
    [allEpisodes]
  );
  const avgUserRating =
    ratings.length > 0
      ? (ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length).toFixed(1)
      : null;

  const recommendations = useMemo(() => {
    const recs = content?.recommendations;
    if (!recs) return [];
    if (Array.isArray(recs)) return recs;
    if (typeof recs === "string") {
      try {
        const parsed = JSON.parse(recs);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  }, [content?.recommendations]);

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
                {/* === Hero + Action Bar === */}
                <DetailHero
                  content={content}
                  isTV={isTV}
                  inWatchlist={inWatchlist}
                  watchlistLoading={watchlistLoading}
                  onPlay={() => handlePlay()}
                  onToggleWatchlist={handleToggleWatchlist}
                  onShare={handleShare}
                  onTrailer={() => setTrailerOpen(true)}
                />

                {/* === Content === */}
                <div className="space-y-6 p-4 sm:p-6 md:p-8">
                  {/* Info: About | Persons | Production + Rating */}
                  <DetailInfo
                    content={content}
                    isTV={isTV}
                    seasons={seasons}
                    allEpisodes={allEpisodes}
                    rating={rating}
                    avgUserRating={avgUserRating}
                    year={year}
                    overview={overview}
                  />

                  {/* Rate This */}
                  <div className="border-t border-border pt-4">
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

                  {/* We Recommend */}
                  {recommendations.length > 0 && (
                    <div className="border-t border-border pt-4">
                      <DetailRecommendations
                        recommendations={recommendations}
                        onItemClick={handleRecommendationClick}
                      />
                    </div>
                  )}
                </div>

                {/* Comments */}
                <DetailComments
                  comments={comments}
                  commentText={commentText}
                  setCommentText={setCommentText}
                  onPostComment={handlePostComment}
                  commentLoading={commentLoading}
                  replyTo={replyTo}
                  setReplyTo={setReplyTo}
                  replyText={replyText}
                  setReplyText={setReplyText}
                  onPostReply={handlePostReply}
                  onDeleteComment={handleDeleteComment}
                  isAuthenticated={status === "authenticated"}
                  userImage={session?.user?.image}
                  userName={session?.user?.name}
                />
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {/* Trailer Modal */}
      <DetailTrailerModal
        trailerUrl={content?.trailer_url}
        open={trailerOpen}
        onClose={() => setTrailerOpen(false)}
      />
    </>
  );
}
