"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { useSafeSession } from "@/lib/use-safe-session";
import { useRouter } from "next/navigation";
import { Header } from "@/components/cinepro/header";
import { Footer } from "@/components/cinepro/footer";
import { MovieCard } from "@/components/cinepro/movie-card";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";
import { getImageUrl } from "@/lib/tmdb";
import { toast } from "sonner";
import {
  Loader2, Camera, Edit3, Save, X, Star, Heart, MessageSquare,
  Play, Clock, Trash2, Film
} from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = "favorites" | "reviews" | "comments" | "watchlist" | "activity";

export function ProfileContent() {
  const { data: session, status } = useSafeSession();
  const router = useRouter();

  const {
    history, favorites, activityLog, profileAvatar, profileBio,
    setProfileAvatar, setProfileBio, loadFavorites, loadActivity, loadHistory,
    removeFromHistory, openPlayer,
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<Tab>("favorites");
  const [editingBio, setEditingBio] = useState(false);
  const [bioText, setBioText] = useState("");
  const [mounted, setMounted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [status, router]);

  useEffect(() => {
    loadFavorites();
    loadActivity();
    loadHistory();
    setMounted(true);
  }, [loadFavorites, loadActivity, loadHistory]);

  // Mock data for reviews & comments (sementara dari localStorage)
  const [reviews, setReviews] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);

  useEffect(() => {
    if (mounted) {
      try {
        const stored = localStorage.getItem("cinestream_ratings");
        if (stored) setReviews(JSON.parse(stored));
      } catch {}
      try {
        const stored = localStorage.getItem("cinestream_comments");
        if (stored) setComments(JSON.parse(stored));
      } catch {}
    }
  }, [mounted]);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("File harus berupa gambar");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Ukuran gambar maksimal 2MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setProfileAvatar(result);
      toast.success("Foto profil diperbarui");
    };
    reader.readAsDataURL(file);
  };

  const handleSaveBio = () => {
    setProfileBio(bioText.trim());
    setEditingBio(false);
    toast.success("Bio diperbarui");
  };

  if (status === "loading" || !mounted) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </main>
    );
  }

  if (!session?.user) return null;

  const userName = session.user.name || "Guest User";
  const userEmail = session.user.email || "Not logged in";

  return (
    <main className="min-h-screen bg-background">
      <Header />
      
      <div className="mx-auto max-w-4xl px-4 py-8 pt-24">
        <h1 className="mb-6 text-2xl font-bold sm:text-3xl">Profil Saya</h1>
        
        {/* Profile Header Card */}
        <div className="relative overflow-hidden rounded-xl border border-border bg-card p-6">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent" />

          <div className="relative flex flex-col items-center gap-6 sm:flex-row sm:items-start">
            {/* Avatar with Upload Button */}
            <div className="relative shrink-0">
              <div className="h-24 w-24 overflow-hidden rounded-full bg-muted sm:h-32 sm:w-32 ring-2 ring-primary ring-offset-2 ring-offset-card">
                {profileAvatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profileAvatar} alt={userName} className="h-full w-full object-cover" />
                ) : session.user.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={session.user.image} alt={userName} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-primary/20">
                    <span className="text-3xl font-bold text-primary">
                      {userName[0]?.toUpperCase() || "U"}
                    </span>
                  </div>
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90"
                aria-label="Change avatar"
              >
                <Camera className="h-4 w-4" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
            </div>

            {/* User Info & Bio */}
            <div className="flex-1 text-center sm:text-left">
              <h2 className="text-xl font-bold sm:text-2xl">{userName}</h2>
              <p className="text-sm text-muted-foreground">{userEmail}</p>
              
              <div className="mt-4 flex flex-wrap justify-center gap-6 sm:justify-start">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">User ID</p>
                  <p className="font-mono text-xs text-muted-foreground">{session.user.id || "N/A"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Role</p>
                  <p className="font-semibold capitalize">{session.user.role || "user"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Language</p>
                  <p className="font-semibold uppercase">{session.user.language || "en"}</p>
                </div>
              </div>

              {/* Bio Editor */}
              <div className="mt-4">
                {editingBio ? (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                    <textarea
                      value={bioText}
                      onChange={(e) => setBioText(e.target.value)}
                      placeholder="Tulis bio kamu..."
                      maxLength={200}
                      rows={2}
                      className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                      autoFocus
                    />
                    <div className="flex gap-1">
                      <Button size="sm" onClick={handleSaveBio}>
                        <Save className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingBio(false)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => { setBioText(profileBio); setEditingBio(true); }}
                    className="cursor-pointer group flex items-start gap-2"
                  >
                    <p className="flex-1 text-sm text-muted-foreground">
                      {profileBio || "Klik untuk menambahkan bio..."}
                    </p>
                    <Edit3 className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="mt-4 flex flex-wrap gap-4 text-sm">
                <span className="flex items-center gap-1">
                  <Heart className="h-4 w-4 text-primary" />
                  <strong>{favorites.length}</strong> Favorites
                </span>
                <span className="flex items-center gap-1">
                  <Play className="h-4 w-4 text-primary" />
                  <strong>{history.length}</strong> Watched
                </span>
                <span className="flex items-center gap-1">
                  <Star className="h-4 w-4 text-primary" />
                  <strong>{reviews.length}</strong> Reviews
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-6 flex gap-2 overflow-x-auto border-b">
          {[
            { id: "favorites" as Tab, label: "Favorites", icon: Heart },
            { id: "reviews" as Tab, label: "Reviews", icon: Star },
            { id: "comments" as Tab, label: "Comments", icon: MessageSquare },
            { id: "watchlist" as Tab, label: "Watchlist", icon: Film },
            { id: "activity" as Tab, label: "Activity", icon: Clock },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="mt-6 min-h-[300px]">
          {/* Favorites */}
          {activeTab === "favorites" && (
            <div>
              {favorites.length === 0 ? (
                <EmptyState icon={Heart} text="Belum ada film favorit" />
              ) : (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                  {favorites.map((item) => (
                    <MovieCard key={item.id} movie={item as any} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Reviews */}
          {activeTab === "reviews" && (
            <div>
              {reviews.length === 0 ? (
                <EmptyState icon={Star} text="Belum ada review" />
              ) : (
                <div className="space-y-3">
                  {reviews.map((review, idx) => (
                    <div key={idx} className="rounded-lg border bg-card p-4">
                      <div className="flex items-center gap-2">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        <span className="font-semibold">{review.rating}/10</span>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {new Date(review.createdAt).toLocaleDateString("id-ID")}
                        </span>
                      </div>
                      <p className="mt-2 text-sm">{review.mediaTitle}</p>
                      {review.review && <p className="mt-1 text-sm text-muted-foreground">{review.review}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Comments */}
          {activeTab === "comments" && (
            <div>
              {comments.length === 0 ? (
                <EmptyState icon={MessageSquare} text="Belum ada komentar" />
              ) : (
                <div className="space-y-3">
                  {comments.map((comment, idx) => (
                    <div key={idx} className="rounded-lg border bg-card p-4">
                      <p className="text-sm">{comment.content}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        on {comment.mediaTitle} • {new Date(comment.createdAt).toLocaleDateString("id-ID")}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Watchlist (History) */}
          {activeTab === "watchlist" && (
            <div>
              {history.length === 0 ? (
                <EmptyState icon={Play} text="Belum ada riwayat tontonan" />
              ) : (
                <div className="space-y-3">
                  {history.map((item) => {
                    const progressPercent = item.progress && item.duration
                      ? (item.progress / item.duration) * 100 : 0;
                    return (
                      <div key={item.id} className="flex items-center gap-3 rounded-lg border bg-card p-3">
                        <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded bg-muted">
                          {item.backdropPath && (
                            <Image
                              src={getImageUrl(item.backdropPath, "w300")}
                              alt={item.title}
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate text-sm font-medium">{item.title}</h3>
                          <p className="text-xs text-muted-foreground">
                            {new Date(item.watchedAt).toLocaleDateString("id-ID")}
                          </p>
                          {progressPercent > 0 && (
                            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
                              <div className="h-full rounded-full bg-primary" style={{ width: `${progressPercent}%` }} />
                            </div>
                          )}
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => openPlayer(item)}>
                          <Play className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => removeFromHistory(item.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Activity */}
          {activeTab === "activity" && (
            <div>
              {activityLog.length === 0 ? (
                <EmptyState icon={Clock} text="Belum ada aktivitas" />
              ) : (
                <div className="space-y-2">
                  {activityLog.map((activity) => (
                    <div key={activity.id} className="flex items-center gap-3 rounded-lg border bg-card p-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                        {activity.type === "watch" && <Play className="h-4 w-4 text-primary" />}
                        {activity.type === "favorite" && <Heart className="h-4 w-4 text-primary" />}
                        {activity.type === "rating" && <Star className="h-4 w-4 text-primary" />}
                        {activity.type === "comment" && <MessageSquare className="h-4 w-4 text-primary" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">
                          <span className="font-medium capitalize">
                            {activity.type === "watch" ? "Watched" : activity.type === "favorite" ? "Added to favorites" : activity.type}
                          </span>
                          {" "}<span className="text-muted-foreground">{activity.mediaTitle}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(activity.timestamp).toLocaleString("id-ID", {
                            day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <Footer />
    </main>
  );
}

function EmptyState({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
      <Icon className="h-12 w-12 text-muted-foreground/30" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
