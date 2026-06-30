"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Play, X, Star, Calendar, Clock, Loader2, Bookmark, Check, Share2,
  MessageSquare, Send, Trash2, CornerDownRight, ChevronLeft, ChevronRight,
  User as UserIcon,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAppStore } from "@/lib/store";
import { getImageUrl, type MovieDetail } from "@/lib/tmdb";
import { MovieCard } from "./movie-card";
import { toast } from "sonner";

interface UserRating { id: string; rating: number; review: string | null; }
interface RatingItem { id: string; rating: number; review: string | null; createdAt: string; userId: string; name: string | null; image: string | null; }
interface CommentItem { id: string; userId: string; mediaId: number; mediaType: string; content: string; parentId: string | null; createdAt: string; updatedAt: string; userName: string | null; userImage: string | null; replies: CommentItem[]; }
interface Episode { episodeNumber: number; name: string; overview: string; stillPath: string | null; airDate: string; runtime: number | null; }

export function DetailModal() {
  const { selectedMedia, setSelectedMedia, openPlayer, addToHistory, setAuthModalOpen } = useAppStore();
  const { data: session, status } = useSession();
  const router = useRouter();

  const handlePersonClick = (personId: number) => {
    setSelectedMedia(null);
    router.push(`/person/${personId}`);
  };
  const [detail, setDetail] = useState<MovieDetail | null>(null);
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
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [episodesLoading, setEpisodesLoading] = useState(false);

  useEffect(() => {
    if (!selectedMedia) {
      Promise.resolve().then(() => {
        setDetail(null); setError(null); setInWatchlist(false);
        setRatings([]); setUserRating(null); setComments([]);
        setReplyTo(null); setReplyText(""); setCommentText("");
        setSeason(1); setEpisode(1); setEpisodes([]);
      });
      return;
    }
    let cancelled = false;
    const loadDetail = async () => {
      await Promise.resolve();
      if (cancelled) return;
      setLoading(true); setError(null);
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
    if (status === "authenticated" && session?.user) {
      fetch("/api/watchlist").then((res) => res.json()).then((data) => {
        if (cancelled) return;
        const exists = data.watchlist?.some((item: any) => item.mediaId === selectedMedia.id && item.mediaType === selectedMedia.type);
        setInWatchlist(!!exists);
      }).catch(() => {});
    }
    fetch(`/api/ratings?mediaId=${selectedMedia.id}&mediaType=${selectedMedia.type}`).then((res) => res.json()).then((data) => {
      if (cancelled) return;
      setRatings(data.ratings || []); setUserRating(data.userRating || null);
    }).catch(() => {});
    fetch(`/api/comments?mediaId=${selectedMedia.id}&mediaType=${selectedMedia.type}`).then((res) => res.json()).then((data) => {
      if (cancelled) return;
      setComments(data.comments || []);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [selectedMedia, session, status]);

  useEffect(() => {
    if (!selectedMedia || selectedMedia.type !== "tv" || !detail) return;
    let cancelled = false;
    setEpisodesLoading(true);
    fetch(`/api/season?id=${selectedMedia.id}&season=${season}`)
      .then((res) => res.json()).then((data) => {
        if (cancelled) return;
        setEpisodes(data.episodes || []);
      }).catch(() => {}).finally(() => { if (!cancelled) setEpisodesLoading(false); });
    return () => { cancelled = true; };
  }, [selectedMedia, detail, season]);

  const handlePlay = (epNum?: number) => {
    if (!selectedMedia) return;
    const ep = epNum || episode;
    if (epNum) setEpisode(epNum);
    addToHistory({ ...selectedMedia, watchedAt: new Date().toISOString() });
    openPlayer(selectedMedia, season, ep);
  };

  const handleToggleWatchlist = async () => {
    if (!selectedMedia || !detail) return;
    if (status !== "authenticated" || !session?.user) { setAuthModalOpen(true); toast.info("Silakan login dulu"); return; }
    setWatchlistLoading(true);
    try {
      if (inWatchlist) {
        const listRes = await fetch("/api/watchlist"); const listData = await listRes.json();
        const item = listData.watchlist?.find((i: any) => i.mediaId === selectedMedia.id && i.mediaType === selectedMedia.type);
        if (item) { await fetch(`/api/watchlist?id=${item.id}`, { method: "DELETE" }); setInWatchlist(false); toast.success("Dihapus dari watchlist"); }
      } else {
        const res = await fetch("/api/watchlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mediaId: selectedMedia.id, mediaType: selectedMedia.type, title: detail.title || detail.name || selectedMedia.title, posterPath: detail.poster_path, backdropPath: detail.backdrop_path }) });
        if (res.ok) { setInWatchlist(true); toast.success("Ditambahkan ke watchlist"); }
      }
    } catch { toast.error("Terjadi kesalahan"); } finally { setWatchlistLoading(false); }
  };

  const handleRate = async (value: number) => {
    if (!selectedMedia) return;
    if (status !== "authenticated") { setAuthModalOpen(true); toast.info("Silakan login dulu"); return; }
    setRatingLoading(true);
    try {
      const res = await fetch("/api/ratings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mediaId: selectedMedia.id, mediaType: selectedMedia.type, rating: value }) });
      if (res.ok) { toast.success(value === 0 ? "Rating dihapus" : "Rating disimpan!"); const refresh = await fetch(`/api/ratings?mediaId=${selectedMedia.id}&mediaType=${selectedMedia.type}`); const data = await refresh.json(); setRatings(data.ratings || []); setUserRating(data.userRating || null); }
    } catch { toast.error("Gagal menyimpan rating"); } finally { setRatingLoading(false); }
  };

  const handlePostComment = async () => {
    if (!selectedMedia || !commentText.trim()) return;
    if (status !== "authenticated") { setAuthModalOpen(true); return; }
    setCommentLoading(true);
    try {
      const res = await fetch("/api/comments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mediaId: selectedMedia.id, mediaType: selectedMedia.type, content: commentText }) });
      if (res.ok) { setCommentText(""); toast.success("Komentar ditambahkan"); const refresh = await fetch(`/api/comments?mediaId=${selectedMedia.id}&mediaType=${selectedMedia.type}`); const data = await refresh.json(); setComments(data.comments || []); }
    } catch { toast.error("Gagal menambahkan komentar"); } finally { setCommentLoading(false); }
  };

  const handlePostReply = async (parentId: string) => {
    if (!selectedMedia || !replyText.trim()) return;
    setCommentLoading(true);
    try {
      const res = await fetch("/api/comments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mediaId: selectedMedia.id, mediaType: selectedMedia.type, content: replyText, parentId }) });
      if (res.ok) { setReplyText(""); setReplyTo(null); toast.success("Reply ditambahkan"); const refresh = await fetch(`/api/comments?mediaId=${selectedMedia.id}&mediaType=${selectedMedia.type}`); const data = await refresh.json(); setComments(data.comments || []); }
    } catch { toast.error("Gagal menambahkan reply"); } finally { setCommentLoading(false); }
  };

  const handleDeleteComment = async (id: string) => {
    try { const res = await fetch(`/api/comments?id=${id}`, { method: "DELETE" }); if (res.ok) { toast.success("Komentar dihapus"); setComments((prev) => prev.filter((c) => c.id !== id)); } } catch { toast.error("Gagal menghapus"); }
  };

  const handleShare = () => {
    if (!selectedMedia) return;
    const shareUrl = `${window.location.origin}/?${selectedMedia.type}=${selectedMedia.id}`;
    const shareTitle = detail?.title || detail?.name || selectedMedia.title || "CineStream";
    if (navigator.share) {
      navigator.share({ title: shareTitle, text: `Tonton ${shareTitle} di CineStream!`, url: shareUrl }).catch(() => {});
    } else {
      navigator.clipboard.writeText(shareUrl);
      toast.success("Link film disalin ke clipboard!");
    }
  };

  if (!selectedMedia) return null;

  const title = detail?.title || detail?.name || selectedMedia.title;
  const year = (detail?.release_date || detail?.first_air_date || "").split("-")[0];
  const tmdbRating = detail?.vote_average?.toFixed(1) || "N/A";
  const runtime = detail?.runtime || detail?.episode_run_time?.[0];
  const director = detail?.credits?.crew?.find((c) => c.job === "Director")?.name;
  const creator = detail?.created_by?.[0]?.name;
  const cast = detail?.credits?.cast?.slice(0, 12) || [];
  const trailer = detail?.videos?.results?.find((v) => v.site === "YouTube" && v.type === "Trailer");
  const similar = detail?.recommendations?.results?.slice(0, 12) || [];
  const avgUserRating = ratings.length > 0 ? (ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length).toFixed(1) : null;
  const isTV = selectedMedia.type === "tv";

  // === FIX #4: Cari logo judul dari TMDB ===
  // Priority: English logo > any logo > null (fallback ke text)
  const logo = (detail as any)?.images?.logos?.find((l: any) => l.iso_639_1 === "en")
    || (detail as any)?.images?.logos?.[0]
    || null;

  return (
    <Dialog open={!!selectedMedia} onOpenChange={(open) => { if (!open) setSelectedMedia(null); }}>
      {/* ============================================================ */}
      {/* FIX #2: Safe-area untuk notch iPhone                         */}
      {/* Modal diposisikan di bawah notch, stretch ke bawah           */}
      {/* ============================================================ */}
            <DialogContent
        className="flex flex-col gap-0 overflow-hidden p-0 max-w-[95vw] sm:max-w-2xl md:max-w-4xl lg:max-w-6xl"
        style={{
          // HANYA constrain size + safe-area, JANGAN override position/transform
          // (shadcn handle centering via translate: -50% -50%)
          height: "calc(100dvh - 2rem)",
          maxHeight: "calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 1rem)",
          marginTop: "env(safe-area-inset-top)",
          marginBottom: "env(safe-area-inset-bottom)",
          borderRadius: "12px",
        }}
      >
        <DialogHeader className="sr-only"><DialogTitle>{title}</DialogTitle></DialogHeader>

        {/* Close button - fixed at top, OUTSIDE scroll area */}
        <button
          onClick={() => setSelectedMedia(null)}
          className="absolute right-3 top-3 z-50 flex h-9 w-9 items-center justify-center rounded-full bg-black/80 text-white backdrop-blur-sm transition-colors hover:bg-primary"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {loading ? (
            <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : error ? (
            <div className="flex h-96 flex-col items-center justify-center gap-3 p-6 text-center"><p className="text-sm text-destructive">{error}</p><Button variant="secondary" size="sm" onClick={() => setSelectedMedia(null)}>Go back</Button></div>
          ) : detail ? (
            <div className="fade-in pb-16">
              {/* === Hero Section === */}
              <div className="relative h-[22vh] min-h-[140px] w-full overflow-hidden bg-muted sm:h-[30vh] md:aspect-video md:h-auto">
                {detail.backdrop_path && (
                  <Image
                    src={getImageUrl(detail.backdrop_path, "original")}
                    alt={title}
                    fill
                    sizes="(max-width: 768px) 100vw, 1024px"
                    className="object-cover"
                    unoptimized
                    priority
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-card via-card/30 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-r from-card/80 via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-3 pr-12 sm:p-6 md:p-8">
                  <Badge className="mb-1 bg-primary text-primary-foreground sm:mb-2">{isTV ? "TV Series" : "Movie"}</Badge>

                  {/* ============================================================ */}
                  {/* FIX #4: Pakai logo TMDB kalau ada, fallback ke text         */}
                  {/* ============================================================ */}
                  {logo ? (
                    <div className="relative h-10 w-auto max-w-[75%] sm:h-14 md:h-20 md:max-w-[60%]">
                      <Image
                        src={getImageUrl(logo.file_path, "w500")}
                        alt={title}
                        fill
                        className="object-contain object-left-bottom drop-shadow-lg"
                        unoptimized
                        sizes="(max-width: 768px) 75vw, 500px"
                      />
                    </div>
                  ) : (
                    <h2 className="text-lg font-extrabold tracking-tight text-white drop-shadow-lg sm:text-2xl md:text-4xl">
                      {title}
                    </h2>
                  )}

                  {detail.tagline && (
                    <p className="mt-0.5 truncate text-[10px] italic text-white/80 sm:text-sm">
                      &quot;{detail.tagline}&quot;
                    </p>
                  )}
                </div>
              </div>

              {/* === Action bar === */}
              <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card/50 px-4 py-3 sm:gap-3 sm:px-6 md:px-8">
                <Button size="sm" onClick={() => handlePlay()} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 sm:size-lg">
                  <Play className="h-4 w-4 fill-current" /><span className="text-xs sm:text-sm">Play</span>
                </Button>
                {trailer && (
                  <a href={`https://www.youtube.com/watch?v=${trailer.key}`} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="secondary" className="gap-2 sm:size-lg">
                      <Play className="h-3 w-3 sm:h-4 sm:w-4" /><span className="text-xs sm:text-sm">Trailer</span>
                    </Button>
                  </a>
                )}
                <Button size="icon" variant="outline" onClick={handleToggleWatchlist} disabled={watchlistLoading} className={inWatchlist ? "border-primary text-primary" : ""}>
                  {watchlistLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : inWatchlist ? <Check className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
                </Button>
                <Button size="icon" variant="outline" aria-label="Share" onClick={handleShare}>
                  <Share2 className="h-4 w-4" />
                </Button>
              </div>

              {/* === Season/Episode selector + Episode thumbnails === */}
              {isTV && detail?.seasons && (
                <div className="border-b border-border bg-card/30 px-4 py-3 sm:px-6 md:px-8">
                  <div className="mb-3 flex items-center gap-2">
                    <Select value={String(season)} onValueChange={(v) => { setSeason(parseInt(v, 10)); setEpisode(1); }}>
                      <SelectTrigger className="h-8 w-28 shrink-0 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {detail.seasons.filter((s) => s.season_number > 0).map((s) => (
                          <SelectItem key={s.id} value={String(s.season_number)}>S{s.season_number}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="ml-auto text-[10px] text-muted-foreground">EP {episode}</span>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8" disabled={episode <= 1} onClick={() => setEpisode(Math.max(1, episode - 1))}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEpisode(episode + 1)}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {episodesLoading ? (
                    <div className="flex h-24 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
                  ) : episodes.length > 0 ? (
                    <div className="overflow-x-auto pb-1" style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
                      <div className="flex gap-2">
                        {episodes.map((ep) => (
                          <button
                            key={ep.episodeNumber}
                            onClick={() => handlePlay(ep.episodeNumber)}
                            className={`relative aspect-video w-28 shrink-0 overflow-hidden rounded-lg border-2 transition-all sm:w-36 ${episode === ep.episodeNumber ? "border-primary" : "border-transparent hover:border-border"}`}
                          >
                            {ep.stillPath ? (
                              <Image src={getImageUrl(ep.stillPath, "w300")} alt={`Ep ${ep.episodeNumber}`} fill sizes="144px" className="object-cover" unoptimized />
                            ) : (
                              <div className="flex h-full items-center justify-center bg-muted"><span className="text-[10px] text-muted-foreground">No Img</span></div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent" />
                            <div className="absolute bottom-1 left-1 right-1">
                              <p className="truncate text-[9px] font-bold text-white">EP {ep.episodeNumber}</p>
                              <p className="truncate text-[8px] text-white/70">{ep.name}</p>
                            </div>
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity hover:opacity-100">
                              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary"><Play className="h-3 w-3 fill-white text-white" /></div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}

              {/* === Content grid === */}
              <div className="grid gap-4 p-4 sm:gap-6 sm:p-6 md:grid-cols-3 md:p-8">
                <div className="min-w-0 md:col-span-2">
                  {/* Meta info */}
                  <div className="mb-3 flex flex-wrap items-center gap-2 text-xs sm:mb-4 sm:gap-3 sm:text-sm">
                    <span className="flex items-center gap-1">
                      <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400 sm:h-4 sm:w-4" />
                      <span className="font-semibold">{tmdbRating}</span>
                      <span className="text-muted-foreground">TMDB</span>
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
                      {detail.genres.map((g) => <Badge key={g.id} variant="outline" className="text-xs">{g.name}</Badge>)}
                    </div>
                  )}

                  {/* Overview */}
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:mb-2 sm:text-sm">Overview</h3>
                  <p className="break-words text-xs leading-relaxed text-foreground/90 sm:text-sm md:text-base">
                    {detail.overview || "No overview available."}
                  </p>

                  {/* ============================================================ */}
                  {/* FIX #3: TOP CAST jadi horizontal scroll                     */}
                  {/* ============================================================ */}
                  {cast.length > 0 && (
                    <div className="mt-4 sm:mt-6">
                      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:mb-3 sm:text-sm">
                        Top Cast
                      </h3>
                      <div
                        className="overflow-x-auto pb-2"
                        style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}
                      >
                        <style>{`div::-webkit-scrollbar { display: none; }`}</style>
                        <div className="flex gap-3">
                          {cast.map((p) => (
                            <button
                              key={p.id}
                              onClick={() => handlePersonClick(p.id)}
                              className="shrink-0 w-20 text-center sm:w-24 group"
                            >
                              <div className="relative mx-auto mb-2 h-20 w-20 overflow-hidden rounded-full bg-muted sm:h-24 sm:w-24 ring-2 ring-transparent transition-all group-hover:ring-primary">
                               {p.profile_path ? (
                                 <Image
                                   src={getImageUrl(p.profile_path, "w185")}
                                   alt={p.name}
                                   fill
                                   sizes="96px"
                                   className="object-cover"
                                   unoptimized
                                  />
                                ) : (
                                  <div className="flex h-full items-center justify-center text-muted-foreground">
                                    <UserIcon className="h-8 w-8" />
                                  </div>
                                )}
                               </div>
                               <p className="truncate text-[11px] font-medium text-foreground group-hover:text-primary sm:text-xs">{p.name}</p>
                               <p className="truncate text-[9px] text-muted-foreground sm:text-[10px]">{p.character}</p>
                              </button>
                            ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Rate This */}
                  <div className="mt-6 border-t border-border pt-4">
                    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:text-sm">
                      Rate This {isTV ? "Series" : "Movie"}
                    </h3>
                    <div className="flex items-center gap-1">
                      {[1,2,3,4,5].map((star) => {
                        const value = star * 2;
                        const isActive = (hoverRating || userRating?.rating || 0) >= value;
                        return (
                          <button
                            key={star}
                            onClick={() => handleRate(value)}
                            onMouseEnter={() => setHoverRating(value)}
                            onMouseLeave={() => setHoverRating(0)}
                            disabled={ratingLoading}
                            className="transition-transform hover:scale-110 disabled:opacity-50"
                          >
                            <Star className={isActive ? "h-6 w-6 fill-yellow-400 text-yellow-400 sm:h-7 sm:w-7" : "h-6 w-6 text-muted-foreground sm:h-7 sm:w-7"} />
                          </button>
                        );
                      })}
                      <span className="ml-3 text-sm font-medium">
                        {ratingLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : userRating ? <span className="text-primary">{userRating.rating}/10</span> : <span className="text-muted-foreground">Click to rate</span>}
                      </span>
                    </div>
                    {userRating && <Button variant="ghost" size="sm" onClick={() => handleRate(0)} className="mt-2 text-xs text-muted-foreground hover:text-destructive">Hapus rating</Button>}
                  </div>
                </div>

                {/* Right sidebar info */}
                <div className="min-w-0 space-y-3 sm:space-y-4">
                  {(director || creator) && (
                    <div className="overflow-hidden">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{isTV ? "Creator" : "Director"}</h4>
                      <p className="mt-0.5 break-words text-xs sm:text-sm">{director || creator}</p>
                    </div>
                  )}
                  {isTV && detail.number_of_seasons && (
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
                    <div className="overflow-hidden">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Languages</h4>
                      <p className="mt-0.5 break-words text-xs sm:text-sm">{detail.spoken_languages.map((l) => l.english_name).join(", ")}</p>
                    </div>
                  )}
                  {detail.production_companies && detail.production_companies.length > 0 && (
                    <div className="overflow-hidden">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Production</h4>
                      <p className="mt-0.5 break-words text-xs sm:text-sm">{detail.production_companies.map((c) => c.name).join(", ")}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* More Like This */}
              {similar.length > 0 && (
                <div className="border-t border-border py-4 sm:py-6">
                  <h3 className="mb-3 px-4 text-sm font-bold sm:mb-4 sm:px-6 sm:text-base md:px-8">More Like This</h3>
                  <div className="overflow-x-auto px-4 pb-2 sm:px-6 lg:px-8" style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
                    <div className="flex gap-3">
                      {similar.map((m) => <div key={`sim-${m.id}`} className="shrink-0"><MovieCard movie={m} size="sm" /></div>)}
                    </div>
                  </div>
                </div>
              )}

              {/* Comments */}
              <div className="border-t border-border px-4 py-4 pb-12 sm:px-6 sm:py-6 md:px-8">
                <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:text-sm">
                  <MessageSquare className="h-4 w-4" />Comments ({comments.length})
                </h3>
                <div className="mb-4 flex gap-2">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarImage src={session?.user?.image || undefined} />
                    <AvatarFallback className="bg-primary/20 text-xs text-primary">{session?.user?.name?.[0]?.toUpperCase() || "U"}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
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
                      <Button size="sm" onClick={handlePostComment} disabled={!commentText.trim() || commentLoading} className="mt-2 gap-1.5">
                        {commentLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}Post
                      </Button>
                    )}
                  </div>
                </div>
                <div className="max-h-[300px] space-y-3 overflow-y-auto pr-1" style={{ scrollbarWidth: "thin", WebkitOverflowScrolling: "touch" }}>
                  {comments.length === 0 ? (
                    <p className="py-4 text-center text-xs text-muted-foreground">Belum ada komentar. Jadilah yang pertama!</p>
                  ) : (
                    comments.map((c) => (
                      <CommentNode
                        key={c.id}
                        comment={c}
                        currentUserId={session?.user?.id}
                        onReply={(id: string) => { setReplyTo(id); setReplyText(""); }}
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
  );
}

function CommentNode({ comment, currentUserId, onReply, replyTo, replyText, setReplyText, onPostReply, onDelete, commentLoading, level }: any) {
  const initial = comment.userName?.[0]?.toUpperCase() || "U";
  const timeAgo = new Date(comment.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  const isOwner = currentUserId === comment.userId;
  return (
    <div className={level > 0 ? "ml-6 border-l border-border pl-3" : ""}>
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
            <p className="mt-1 break-words text-xs leading-relaxed sm:text-sm">{comment.content}</p>
          </div>
          <div className="mt-1 flex items-center gap-3 px-1">
            <button onClick={() => onReply(comment.id)} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary">
              <CornerDownRight className="h-3 w-3" />Reply
            </button>
            {isOwner && (
              <button onClick={() => onDelete(comment.id)} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-destructive">
                <Trash2 className="h-3 w-3" />Delete
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
              <Button size="sm" onClick={() => onPostReply(comment.id)} disabled={!replyText.trim() || commentLoading} className="gap-1 self-end">
                {commentLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
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
