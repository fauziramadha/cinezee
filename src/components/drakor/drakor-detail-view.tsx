"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Header } from "@/components/cinepro/header";
import { Footer } from "@/components/cinepro/footer";
import { SearchModal } from "@/components/cinepro/search-modal";
import { DetailModal } from "@/components/cinepro/detail-modal";
import { PlayerModal } from "@/components/cinepro/player-modal";
import { AuthModal } from "@/components/cinepro/auth-modal";
import { ArrowLeft, Play, Calendar, Tv, ChevronRight, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface DrakorDetailViewProps {
  detail: any;
}

// Helper: ambil inisial dari nama
function getInitials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

// Helper: ambil warna berdasarkan nama (untuk avatar warna-warni)
function getAvatarColor(name: string): string {
  const colors = [
    "bg-red-500/80",
    "bg-blue-500/80",
    "bg-green-500/80",
    "bg-yellow-500/80",
    "bg-purple-500/80",
    "bg-pink-500/80",
    "bg-indigo-500/80",
    "bg-teal-500/80",
    "bg-orange-500/80",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function DrakorDetailView({ detail }: DrakorDetailViewProps) {
  const router = useRouter();

  const title = detail.title || "Untitled";
  const poster = detail.poster || detail.imageUrl || null;
  const synopsis = detail.synopsis || "";
  const details = (detail.details && typeof detail.details === "object") ? detail.details : {};
  const episodes = Array.isArray(detail.episodes) ? detail.episodes : [];
  const cast = Array.isArray(detail.cast) ? detail.cast : [];
  const drakorId = detail.id || detail.slug || "";

  const sortedEpisodes = [...episodes].sort((a, b) => {
    const numA = parseInt(String(a?.number || "0").match(/\d+/)?.[0] || "0", 10);
    const numB = parseInt(String(b?.number || "0").match(/\d+/)?.[0] || "0", 10);
    return numA - numB;
  });

  const firstEpisode = sortedEpisodes[0];

  let genres: string[] = [];
  const genreStr = details.Genres || "";
  if (genreStr) {
    genres = genreStr.split(",").map((g: string) => g.trim()).filter(Boolean);
  }

  const posterProxyUrl = poster ? `/api/proxy-image?url=${encodeURIComponent(String(poster))}` : null;

  // SAFE fields only
  const safeDetails = {
    Title: details.Title || "",
    Type: details.Type || "",
    Format: details.Format || "",
    Episodes: details.Episodes || "",
    Duration: details.Duration || "",
    Aired: details.Aired || "",
    AiredOn: details["Aired On"] || "",
    Network: details["Original Network"] || "",
    Country: details.Country || "",
  };

  // Smart back button
  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/drakor");
    }
  };

  return (
    <main className="min-h-screen bg-background overflow-hidden">
      <Header />
      <div className="relative h-[40vh] min-h-[280px] w-full overflow-hidden bg-muted sm:h-[50vh]">
        {posterProxyUrl && (
          <Image
            src={posterProxyUrl}
            alt={title}
            fill
            sizes="100vw"
            className="object-cover opacity-30 blur-sm scale-110"
            unoptimized
            priority
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/30" />
      </div>
      <div className="container mx-auto -mt-32 px-4 pb-12 sm:-mt-40">
         <button
          onClick={handleBack}
          className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg transition-colors hover:bg-primary/90"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali
        </button>

        <div className="mb-3">
          <span className="inline-block rounded bg-pink-500/90 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
            Drakor
          </span>
        </div>

        <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
          <div className="relative mx-auto aspect-[2/3] w-40 shrink-0 overflow-hidden rounded-lg bg-muted shadow-2xl sm:mx-0 sm:w-48 md:w-56">
            {posterProxyUrl ? (
              <Image
                src={posterProxyUrl}
                alt={title}
                fill
                sizes="(max-width: 640px) 160px, 224px"
                className="object-cover"
                unoptimized
                priority
              />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <Tv className="h-12 w-12" />
              </div>
            )}
          </div>
          <div className="flex-1 text-center sm:text-left min-w-0">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl break-words">{title}</h1>
            {safeDetails.Format && (
              <p className="mt-1 text-sm text-muted-foreground break-words">{safeDetails.Format}</p>
            )}
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              {safeDetails.Type && <Badge variant="secondary" className="gap-1"><Tv className="h-3 w-3" />{safeDetails.Type}</Badge>}
              {safeDetails.Episodes && <Badge variant="secondary">{safeDetails.Episodes} Episode</Badge>}
              {safeDetails.Duration && <Badge variant="secondary" className="gap-1"><Calendar className="h-3 w-3" />{safeDetails.Duration}</Badge>}
              {safeDetails.Country && <Badge variant="secondary">{safeDetails.Country}</Badge>}
            </div>
            <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
              {firstEpisode && (
                <Button
                  size="sm"
                  onClick={() => router.push(`/drakor/watch/${drakorId}/${firstEpisode.number || 1}`)}
                  className="gap-2"
                >
                  <Play className="h-4 w-4 fill-current" />Tonton Episode 1
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-6 md:grid md:grid-cols-3">
          <div className="md:col-span-2 min-w-0">
            {genres.length > 0 && (
              <div className="mb-4">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Genre</h3>
                <div className="flex flex-wrap gap-1.5">
                  {genres.map((g: string, idx: number) => (
                    <Badge key={idx} variant="outline" className="cursor-default">
                      {g}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {synopsis && (
              <div className="mb-6">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Synopsis</h3>
                <div className="space-y-2 text-sm leading-relaxed text-foreground/90" style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}>
                  {synopsis.split("\n").filter((p: string) => p.trim()).map((p: string, idx: number) => (
                    <p key={idx}>{p}</p>
                  ))}
                </div>
              </div>
            )}

            {/* CAST SECTION - Baru ditambahkan */}
            {cast.length > 0 && (
              <div className="mb-6">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pemeran ({cast.length})</h3>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {cast.map((member: any, idx: number) => {
                    const name = member?.name || "Unknown";
                    const role = member?.role || "";
                    const url = member?.url || "";
                    const initials = getInitials(name);
                    const avatarColor = getAvatarColor(name);

                    return (
                      <div
                        key={idx}
                        className="flex items-center gap-2.5 rounded-lg border border-border bg-card p-2.5"
                      >
                        {/* Avatar dengan inisial (karena API tidak punya foto) */}
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${avatarColor} text-sm font-bold text-white`}>
                          {initials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-foreground">{name}</p>
                          {role && (
                            <p className="truncate text-[10px] text-muted-foreground">as {role}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {sortedEpisodes.length > 0 && (
              <div className="min-w-0">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Episode ({sortedEpisodes.length})
                </h3>
                <div className="max-h-[500px] space-y-1.5 overflow-y-auto pr-2">
                  {sortedEpisodes.map((ep: any, idx: number) => {
                    const epNum = ep?.number || (idx + 1);
                    const epTitle = (ep?.episode as string) || ("Episode " + epNum);
                    return (
                      <Link
                        key={idx}
                        href={`/drakor/watch/${drakorId}/${epNum}`}
                        className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card p-3 transition-all hover:border-primary hover:bg-primary/5"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                            {epNum}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {epTitle}
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="w-full md:space-y-4">
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Informasi</h3>
              <dl className="space-y-2 text-xs">
                {safeDetails.Title && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Judul</dt>
                    <dd className="font-medium text-right">{safeDetails.Title}</dd>
                  </div>
                )}
                {safeDetails.Type && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Tipe</dt>
                    <dd className="font-medium text-right">{safeDetails.Type}</dd>
                  </div>
                )}
                {safeDetails.Format && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Format</dt>
                    <dd className="font-medium text-right">{safeDetails.Format}</dd>
                  </div>
                )}
                {safeDetails.Episodes && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Total Episode</dt>
                    <dd className="font-medium text-right">{safeDetails.Episodes}</dd>
                  </div>
                )}
                {safeDetails.Duration && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Durasi</dt>
                    <dd className="font-medium text-right">{safeDetails.Duration}</dd>
                  </div>
                )}
                {safeDetails.Aired && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Tayang</dt>
                    <dd className="font-medium text-right">{safeDetails.Aired}</dd>
                  </div>
                )}
                {safeDetails.AiredOn && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Jadwal</dt>
                    <dd className="font-medium text-right">{safeDetails.AiredOn}</dd>
                  </div>
                )}
                {safeDetails.Network && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Network</dt>
                    <dd className="font-medium text-right">{safeDetails.Network}</dd>
                  </div>
                )}
                {safeDetails.Country && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Negara</dt>
                    <dd className="font-medium text-right">{safeDetails.Country}</dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        </div>
      </div>
      <Footer />
      <SearchModal />
      <DetailModal />
      <PlayerModal />
      <AuthModal />
    </main>
  );
}
