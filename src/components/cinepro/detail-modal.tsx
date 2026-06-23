"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { useSession } from "next-auth/react";
import {
  Play,
  X,
  Star,
  Calendar,
  Clock,
  Loader2,
  Bookmark,
  Check,
  Share2,
  MessageSquare,
  Send,
  Trash2,
  CornerDownRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAppStore } from "@/lib/store";
import { getImageUrl, type MovieDetail } from "@/lib/tmdb";
import { MovieCard } from "./movie-card";
import { toast } from "sonner";

// =====================================================
// Types
// =====================================================
interface UserRating {
  id: string;
  rating: number;
  review: string | null;
}

interface RatingItem {
  id: string;
  rating: number;
  review: string | null;
  createdAt: string;
  userId: string;
  name: string | null;
  image: string | null;
}

interface CommentItem {
  id: string;
  userId: string;
  mediaId: number;
  mediaType: string;
  content: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
  userName: string | null;
  userImage: string | null;
  replies: CommentItem[];
}

// =====================================================
// Main Component
// =====================================================
export function DetailModal() {
  const { selectedMedia, setSelectedMedia, openPlayer, addToHistory, setAuthModalOpen } = useAppStore();
  const { data: session, status } = useSession();
  
  // Detail state
  const [detail, setDetail] = useState<MovieDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Watchlist state
  const [inWatchlist, setInWatchlist] = useState(false);
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  
  // Rating state
  const [ratings, setRatings] = useState<RatingItem[]>([]);
  const [userRating, setUserRating] = useState<UserRating | null>(null);
  const [hoverRating, setHoverRating] = useState(0);
  const [ratingLoading, setRatingLoading] = useState(false);
  
  // Comment state
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentText, setCommentText] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  // =====================================================
  // Fetch all data when media is selected
  // =====================================================
  useEffect(() => {
    if (!selectedMedia) {
      Promise.resolve().then(() => {
        setDetail(null);
        setError(null);
        setInWatchlist(false);
        setRatings([]);
        setUserRating(null);
        setComments([]);
        setReplyTo(null);
        setReplyText("");
        setCommentText("");
      });
      return;
    }

    let cancelled = false;
    const loadDetail = async () => {
      await Promise.resolve();
      if (cancelled) return;
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/detail/${selectedMedia.id}?type=${selectedMedia.type}`);
        if (!res.ok) throw new Error("Failed to load");
        const data: MovieDetail = await res.json();
        if (cancelled) return;
        setDetail(data);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadDetail();

    // Fetch watchlist status
    if (status === "authenticated" && session?.user) {
      fetch("/api/watchlist")
        .then((res) => res.json())
        .then((data) => {
          if (cancelled) return;
          const exists = data.watchlist?.some(
            (item: any) => item.mediaId === selectedMedia.id && item.mediaType === selectedMedia.type,
          );
          setInWatchlist(!!exists);
        })
        .catch(() => {});
    }

    // Fetch ratings
    fetch(`/api/ratings?mediaId=${selectedMedia.id}&mediaType=${selectedMedia.type}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setRatings(data.ratings || []);
        setUserRating(data.userRating || null);
      })
      .catch(() => {});

    // Fetch comments
    fetch(`/api/comments?mediaId=${selectedMedia.id}&mediaType=${selectedMedia.type}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setComments(data.comments || []);
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [selectedMedia, session, status]);

  // =====================================================
  // Handlers
  // =====================================================
  const handleOpen = () => {
    if (!selectedMedia) return;
    addToHistory({ ...selectedMedia, watchedAt: new Date().toISOString() });
    openPlayer(selectedMedia);
  };

  const handleToggleWatchlist = async () => {
    if (!selectedMedia || !detail) return;
    if (status !== "authenticated" || !session?.user) {
      setAuthModalOpen(true);
      toast.info("Silakan login dulu untuk menyimpan ke watchlist");
      return;
    }
    setWatchlistLoading(true);
    try {
      if (inWatchlist) {
        const listRes = await fetch("/api/watchlist");
        const listData = await listRes.json();
        const item = listData.watchlist?.find(
          (i: any) => i.mediaId === selectedMedia.id && i.mediaType === selectedMedia.type,
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
            title: detail.title || detail.name || selectedMedia.title,
            posterPath: detail.poster_path,
            backdropPath: detail.backdrop_path,
          }),
        });
        if (res.ok) {
          setInWatchlist(true);
          toast.success("Ditambahkan ke watchlist");
        }
      }
    } catch {
      toast.error("Terjadi kesalahan. Silakan coba lagi.");
    } finally {
      setWatchlistLoading(false);
    }
  };

  const handleRate = async (value: number) => {
    if (!selectedMedia) return;
    if (status !== "authenticated") {
      setAuthModalOpen(true);
      toast.info("Silakan login dulu untuk memberi rating");
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
        setUserRating({ id: "", rating: value, review: null });
        toast.success(value === 0 ? "Rating dihapus" : "Rating disimpan!");
        // Refresh ratings
        const refresh = await fetch(`/api/ratings?mediaId=${selectedMedia.id}&mediaType=${selectedMedia.type}`);
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
      toast.info("Silakan login dulu untuk berkomentar");
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
        const refresh = await fetch(`/api/comments?mediaId=${selectedMedia.id}&mediaType=${selectedMedia.type}`);
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
    if (status !== "authenticated") return;
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
        const refresh = await fetch(`/api/comments?mediaId=${selectedMedia.id}&mediaType=${selectedMedia.type}`);
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
      toast.error("Gagal menghapus komentar");
    }
  };

  // =====================================================
  // Render
  // =====================================================
  if (!selectedMedia) return null;

  const title = detail?.title || detail?.name || selectedMedia.title;
  const year = (detail?.release_date || detail?.first_air_date || "").split("-")[0];
  const tmdbRating = detail?.vote_average?.toFixed(1) || "N/A";
  const runtime = detail?.runtime || detail?.episode_run_time?.[0];
  const director = detail?.credits?.crew?.find((c) => c.job === "Director")?.name;
  const creator = detail?.created_by?.[0]?.name;
  const cast = detail?.credits?.cast?.slice(0, 8) || [];
  const trailer = detail?.videos?.results?.find((v) => v.site === "YouTube" && v.type === "Trailer");
  const similar = detail?.recommendations?.results?.slice(0, 12) || [];

  // Calculate average user rating
  const avgUserRating = ratings.length > 0
    ? (ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length).toFixed(1)
    : null;

  return (
    <Dialog open={!!selectedMedia} onOpenChange={(open) => { if (!open) setSelectedMedia(null); }}>
      <DialogContent className="max-h-[95vh] max-w-[95vw] overflow-hidden p-0 sm:max-w-2xl md:max-w-4xl lg:max-w-6xl">
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <button
          onClick={() => setSelectedMedia(null)}
          className="absolute right-3 top-3 z-30 flex h-9 w-9 items-center justify-center rounded-full bg-black/70 text-white backdrop-blur-sm transition-colors hover:bg-primary"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <ScrollArea className="max-h-[95vh]">
          {loading && (
            <div className="flex h-96 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}

          {error && !loading && (
            <div className="flex h-96 flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="secondary" size="sm" onClick={() => setSelectedMedia(null)}>
                Go back
              </Button>
            </div>
          )}

          {detail && !loading && !error && (
            <div className="fade-in">
              {/* Hero section */}
              <div className="relative aspect-video w-full overflow-hidden bg-muted">
                {detail.backdrop_path && (
                  <Image src={getImageUrl(detail.backdrop_path, "original")} alt={title} fill sizes="(max-width: 768px) 100vw, 1024px" className="object-cover" unoptimized priority />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-card via-card/30 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-r from-card/80 via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 md:p-8">
                  <Badge className="mb-2 bg-primary text-primary-foreground">
                    {selectedMedia.type === "tv" ? "TV Series" : "Movie"}
                  </Badge>
                  <h2 className="text-xl font-extrabold tracking-tight text-white drop-shadow-lg sm:text-2xl md:text-4xl">
                    {title}
                  </h2>
                  {detail.tagline && (
                    <p className="mt-1 text-xs italic text-white/80 sm:text-sm">
                      &quot;{detail.tagline}&quot;
                    </p>
                  )}
                </div>
              </div>

              {/* Action bar */}
              <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card/50 px-4 py-3 sm:gap-3 sm:px-6 sm:py-4 md:px-8">
                <Button size="lg" onClick={handleOpen} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
                  <Play className="h-4 w-4 fill-current sm:h-5 sm:w-5" />
                  Play Now
                </Button>
                {trailer && (
                  <a href={`https://www.youtube.com/watch?v=${trailer.key}`} target="_blank" rel="noopener noreferrer">
                    <Button size="lg" variant="secondary" className="gap-2">
                      <Play className="h-4 w-4" />
                      Trailer
                    </Button>
                  </a>
                )}
                <Button size="icon" variant="outline" onClick={handleToggleWatchlist} disabled={watchlistLoading} aria-label={inWatchlist ? "Remove from watchlist" : "Add to watchlist"} className={inWatchlist ? "border-primary text-primary" : ""}>
                  {watchlistLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : inWatchlist ? <Check className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
                </Button>
                <Button size="icon" variant="outline" aria-label="Share">
                  <Share2 className="h-4 w-4" />
                </Button>
              </div>

              {/* Content grid */}
              <div className="grid gap-4 p-4 sm:gap-6 sm:p-6 md:grid-cols-3 md:p-8">
                {/* Left column */}
                <div className="md:col-span-2">
                  {/* Quick stats */}
                  <div className="mb-3 flex flex-wrap items-center gap-2 text-xs sm:mb-4 sm:gap-3 sm:text-sm">
                    <span className="flex items-center gap-1">
                      <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400 sm:h-4 sm:w-4" />
                      <span className="font-semibold">{tmdbRating}</span>
                      <span className="text-muted-foreground">TMDB ({detail.vote_count?.toLocaleString()})</span>
                    </span>
                    {avgUserRating && (
                      <span className="flex items-center gap-1 text-primary">
                        <Star className="h-3.5 w-3.5 fill-primary text-primary sm:h-4 sm:w-4" />
                        <span className="font-semibold">{avgUserRating}</span>
                        <span className="text-muted-foreground">User ({ratings.length})</span>
                      </span>
                    )}
                    {year && (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4" />{year}
                      </span>
                    )}
                    {runtime && (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />{runtime}m
                      </span>
                    )}
                    {detail.status && <Badge variant="secondary" className="text-xs">{detail.status}</Badge>}
                  </div>

                  {/* Genres */}
                  {detail.genres && detail.genres.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-1.5 sm:mb-4">
                      {detail.genres.map((genre) => (
                        <Badge key={genre.id} variant="outline" className="text-xs">{genre.name}</Badge>
                      ))}
                    </div>
                  )}

                  {/* Overview */}
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:mb-2 sm:text-sm">Overview</h3>
                  <p className="text-xs leading-relaxed text-foreground/90 sm:text-sm md:text-base">
                    {detail.overview || "No overview available."}
                  </p>

                  {/* Cast */}
                  {cast.length > 0 && (
                    <div className="mt-4 sm:mt-6">
                      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:mb-3 sm:text-sm">Top Cast</h3>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
                        {cast.map((person) => (
                          <div key={person.id} className="flex items-center gap-2">
                            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-muted sm:h-12 sm:w-12">
                              {person.profile_path && (
                                <Image src={getImageUrl(person.profile_path, "w185")} alt={person.name} fill sizes="48px" className="object-cover" unoptimized />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-medium sm:text-sm">{person.name}</p>
                              <p className="truncate text-[10px] text-muted-foreground sm:text-xs">{person.character}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ===================================================== */}
                  {/* Rating Section (NEW) */}
                  {/* ===================================================== */}
                  <div className="mt-6 border-t border-border pt-4">
                    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:text-sm">
                      Rate This {selectedMedia.type === "tv" ? "Series" : "Movie"}
                    </h3>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => {
                        const value = star * 2; // 5 stars = 10 rating
                        const isActive = (hoverRating || userRating?.rating || 0) >= value;
                        return (
                          <button
                            key={star}
                            onClick={() => handleRate(value)}
                            onMouseEnter={() => setHoverRating(value)}
                            onMouseLeave={() => setHoverRating(0)}
                            disabled={ratingLoading}
                            className="transition-transform hover:scale-110 disabled:opacity-50"
                            aria-label={`Rate ${value} out of 10`}
                          >
                            <Star
                              className={isActive ? "h-6 w-6 fill-yellow-400 text-yellow-400 sm:h-7 sm:w-7" : "h-6 w-6 text-muted-foreground sm:h-7 sm:w-7"}
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

                  {/* ===================================================== */}
                  {/* Comments Section (NEW) */}
                  {/* ===================================================== */}
                  <div className="mt-6 border-t border-border pt-4">
                    <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:text-sm">
                      <MessageSquare className="h-4 w-4" />
                      Comments ({comments.length})
                    </h3>

                    {/* Comment form */}
                    <div className="mb-4 flex gap-2">
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarImage src={session?.user?.image || undefined} />
                        <AvatarFallback className="bg-primary/20 text-xs text-primary">
                          {session?.user?.name?.[0]?.toUpperCase() || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <textarea
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                          placeholder={status === "authenticated" ? "Tulis komentar..." : "Login untuk berkomentar"}
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
                            {commentLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                            Post
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Comments list */}
                    <div className="space-y-3">
                      {comments.length === 0 ? (
                        <p className="py-4 text-center text-xs text-muted-foreground">
                          Belum ada komentar. Jadilah yang pertama!
                        </p>
                      ) : (
                        comments.map((comment) => (
                          <CommentNode
                            key={comment.id}
                            comment={comment}
                            currentUserId={session?.user?.id}
                            onReply={(id) => { setReplyTo(id); setReplyText(""); }}
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

                {/* Right column */}
                <div className="space-y-3 sm:space-y-4">
                  {(director || creator) && (
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {selectedMedia.type === "tv" ? "Creator" : "Director"}
                      </h4>
                      <p className="mt-0.5 text-xs sm:text-sm">{director || creator}</p>
                    </div>
                  )}
                  {selectedMedia.type === "tv" && detail.number_of_seasons && (
                    <div className="flex gap-4">
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Seasons</h4>
                        <p className="mt-0.5 text-xs sm:text-sm">{detail.number_of_seasons}</p>
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Episodes</h4>
                        <p className="mt-0.5 text-xs sm:text-sm">{detail.number_of_episodes}</p>
                      </div>
                    </div>
                  )}
                  {detail.spoken_languages && detail.spoken_languages.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Languages</h4>
                      <p className="mt-0.5 text-xs sm:text-sm">{detail.spoken_languages.map((l) => l.english_name).join(", ")}</p>
                    </div>
                  )}
                  {detail.production_companies && detail.production_companies.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Production</h4>
                      <p className="mt-0.5 text-xs sm:text-sm">{detail.production_companies.map((c) => c.name).join(", ")}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Similar */}
              {similar.length > 0 && (
                <div className="border-t border-border px-4 py-4 sm:px-6 sm:py-6 md:px-8">
                  <h3 className="mb-3 text-sm font-bold sm:mb-4 sm:text-base">More Like This</h3>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 md:grid-cols-5 lg:grid-cols-6">
                    {similar.map((movie) => (
                      <MovieCard key={`sim-${movie.id}`} movie={movie} size="sm" />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// =====================================================
// Comment Node Component (recursive for replies)
// =====================================================
interface CommentNodeProps {
  comment: CommentItem;
  currentUserId?: string;
  onReply: (id: string) => void;
  replyTo: string | null;
  replyText: string;
  setReplyText: (text: string) => void;
  onPostReply: (parentId: string) => void;
  onDelete: (id: string) => void;
  commentLoading: boolean;
  level: number;
}

function CommentNode({
  comment, currentUserId, onReply, replyTo, replyText, setReplyText, onPostReply, onDelete, commentLoading, level,
}: CommentNodeProps) {
  const initial = comment.userName?.[0]?.toUpperCase() || "U";
  const timeAgo = new Date(comment.createdAt).toLocaleDateString("id-ID", {
    day: "numeric", month: "short", year: "numeric",
  });
  const isOwner = currentUserId === comment.userId;

  return (
    <div className={level > 0 ? "ml-8 border-l border-border pl-3" : ""}>
      <div className="flex gap-2">
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarImage src={comment.userImage || undefined} />
          <AvatarFallback className="bg-primary/20 text-xs text-primary">{initial}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="rounded-lg bg-muted/40 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold">{comment.userName || "Anonymous"}</span>
              <span className="text-[10px] text-muted-foreground">{timeAgo}</span>
            </div>
            <p className="mt-1 text-xs leading-relaxed sm:text-sm">{comment.content}</p>
          </div>
          <div className="mt-1 flex items-center gap-3 px-1">
            <button
              onClick={() => onReply(comment.id)}
              className="flex items-center gap-1 text-[10px] text-muted-foreground transition-colors hover:text-primary"
            >
              <CornerDownRight className="h-3 w-3" />
              Reply
            </button>
            {isOwner && (
              <button
                onClick={() => onDelete(comment.id)}
                className="flex items-center gap-1 text-[10px] text-muted-foreground transition-colors hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
                Delete
              </button>
            )}
          </div>

          {/* Reply form */}
          {replyTo === comment.id && (
            <div className="mt-2 flex gap-2">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder={`Reply to ${comment.userName || "user"}...`}
                className="flex-1 resize-none rounded-lg border border-border bg-transparent px-3 py-2 text-xs outline-none placeholder:text-muted-foreground focus:border-primary"
                rows={2}
                maxLength={2000}
                autoFocus
              />
              <Button size="sm" onClick={() => onPostReply(comment.id)} disabled={!replyText.trim() || commentLoading} className="gap-1 self-end">
                {commentLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Render replies recursively */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-3 space-y-3">
          {comment.replies.map((reply) => (
            <CommentNode
              key={reply.id}
              comment={reply}
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
