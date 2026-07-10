"use client";

import { useEffect, useState, Component, ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Header } from "@/components/cinepro/header";
import { Footer } from "@/components/cinepro/footer";
import { SearchModal } from "@/components/cinepro/search-modal";
import { DetailModal } from "@/components/cinepro/detail-modal";
import { PlayerModal } from "@/components/cinepro/player-modal";
import { AuthModal } from "@/components/cinepro/auth-modal";
import { Loader2, AlertCircle, ArrowLeft, Play, Calendar, Tv, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface DrakorDetailContentProps {
  slug: string;
}

// Error Boundary - catch error saat render, tampilkan fallback UI
class DetailErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error) {
    console.error("[DrakorDetail] Render error:", error);
  }
  render() {
    if (this.state.hasError) return <>{this.props.fallback}</>;
    return this.props.children;
  }
}

// Safe string helper - handle mojibake / null / undefined
function safeStr(val: any): string {
  if (val === null || val === undefined) return "";
  try {
    const s = String(val);
    // Cek apakah string mengandung karakter replacement (mojibake indicator)
    // Tetap return saja - browser bisa handle
    return s;
  } catch {
    return "";
  }
}

// Safe array helper
function safeArr(val: any): any[] {
  if (Array.isArray(val)) return val;
  return [];
}

// Safe object helper
function safeObj(val: any): Record<string, any> {
  if (val && typeof val === "object" && !Array.isArray(val)) return val;
  return {};
}

export function DrakorDetailContent({ slug }: DrakorDetailContentProps) {
  const router = useRouter();
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch("/api/drakor/detail/" + slug)
      .then((res) => { if (!res.ok) throw new Error("HTTP " + res.status); return res.json(); })
      .then((json) => {
        try {
          const raw = json?.data || json;
          if (raw && (raw.title || raw.id)) {
            setDetail(raw);
          } else {
            throw new Error("Drakor tidak ditemukan");
          }
        } catch (e) {
          throw new Error("Format response tidak valid");
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <main className="min-h-screen bg-background">
        <Header />
        <div className="flex h-[60vh] items-center justify-center pt-20">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
        <Footer />
        <SearchModal />
        <DetailModal />
        <PlayerModal />
        <AuthModal />
      </main>
    );
  }

  if (error || !detail) {
    return (
      <main className="min-h-screen bg-background">
        <Header />
        <div className="flex h-[60vh] flex-col items-center justify-center gap-3 pt-20 text-center">
          <AlertCircle className="h-10 w-10 text-destructive" />
          <p className="text-sm text-destructive">{error || "Tidak ditemukan"}</p>
          <Button variant="secondary" size="sm" onClick={() => router.push("/drakor")} className="gap-1.5">
            <ArrowLeft className="h-3.5 w-3.5" />Kembali
          </Button>
        </div>
        <Footer />
        <SearchModal />
        <DetailModal />
        <PlayerModal />
        <AuthModal />
      </main>
    );
  }

  // Defensive parsing
  const title = safeStr(detail.title) || "Untitled";
  const poster = detail.poster || detail.imageUrl || null;
  const synopsis = safeStr(detail.synopsis);
  const details = safeObj(detail.details);
  const episodes = safeArr(detail.episodes);
  const drakorId = safeStr(detail.id || detail.slug || slug);

  // Sort episodes safely
  let sortedEpisodes: any[] = [];
  try {
    sortedEpisodes = [...episodes].sort((a, b) => {
      const numA = parseInt(safeStr(a?.number || a?.episode || "0").match(/\d+/)?.[0] || "0", 10);
      const numB = parseInt(safeStr(b?.number || b?.episode || "0").match(/\d+/)?.[0] || "0", 10);
      return numA - numB;
    });
  } catch {
    sortedEpisodes = episodes;
  }

  const firstEpisode = sortedEpisodes[0];

  // Parse genres safely
  let genres: string[] = [];
  try {
    const genreStr = safeStr(details.Genres);
    if (genreStr) {
      genres = genreStr.split(",").map((g: string) => safeStr(g).trim()).filter(Boolean);
    }
  } catch {
    genres = [];
  }

  // Safe detail field accessor
  const getDetail = (key: string): string => safeStr(details[key]);

  // Fallback UI jika ada error saat render
  const errorFallback = (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3 pt-20 text-center">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <p className="text-sm text-destructive">Terjadi error saat menampilkan detail</p>
        <Button variant="secondary" size="sm" onClick={() => router.push("/drakor")} className="gap-1.5">
          <ArrowLeft className="h-3.5 w-3.5" />Kembali ke Drakor
        </Button>
      </div>
      <Footer />
      <SearchModal />
      <DetailModal />
      <PlayerModal />
      <AuthModal />
    </main>
  );

  return (
    <DetailErrorBoundary fallback={errorFallback}>
      <main className="min-h-screen bg-background overflow-hidden">
        <Header />
        <div className="relative h-[40vh] min-h-[280px] w-full overflow-hidden bg-muted sm:h-[50vh]">
          {poster && (
            <Image
              src={`/api/proxy-image?url=${encodeURIComponent(safeStr(poster))}`}
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
          <button onClick={() => router.push("/drakor")} className="mb-4 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />Kembali ke Drakor
          </button>

          <div className="mb-3">
            <span className="inline-block rounded bg-pink-500/90 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
              Drakor
            </span>
          </div>

          {/* Hero Section */}
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
            <div className="relative mx-auto aspect-[2/3] w-40 shrink-0 overflow-hidden rounded-lg bg-muted shadow-2xl sm:mx-0 sm:w-48 md:w-56">
              {poster ? (
                <Image
                  src={`/api/proxy-image?url=${encodeURIComponent(safeStr(poster))}`}
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
              {getDetail("Format") && (
                <p className="mt-1 text-sm text-muted-foreground break-words">{getDetail("Format")}</p>
              )}
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                {getDetail("Type") && <Badge variant="secondary" className="gap-1"><Tv className="h-3 w-3" />{getDetail("Type")}</Badge>}
                {getDetail("Episodes") && <Badge variant="secondary">{getDetail("Episodes")} Episode</Badge>}
                {getDetail("Duration") && <Badge variant="secondary" className="gap-1"><Calendar className="h-3 w-3" />{getDetail("Duration")}</Badge>}
                {getDetail("Country") && <Badge variant="secondary">{getDetail("Country")}</Badge>}
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

          {/* Content Grid */}
          <div className="mt-8 flex flex-col gap-6 md:grid md:grid-cols-3">
            {/* Main Content */}
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

              {sortedEpisodes.length > 0 && (
                <div className="min-w-0">
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Episode ({sortedEpisodes.length})
                  </h3>
                  <div className="max-h-[500px] space-y-1.5 overflow-y-auto pr-2">
                    {sortedEpisodes.map((ep: any, idx: number) => {
                      const epNum = ep?.number || (idx + 1);
                      const epTitle = safeStr(ep?.episode) || ("Episode " + epNum);
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

            {/* Sidebar Info */}
            <div className="w-full md:space-y-4">
              <div className="rounded-lg border border-border bg-card p-4">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Informasi</h3>
                <dl className="space-y-2 text-xs">
                  {getDetail("Title") && (
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Judul</dt>
                      <dd className="font-medium text-right">{getDetail("Title")}</dd>
                    </div>
                  )}
                  {getDetail("Type") && (
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Tipe</dt>
                      <dd className="font-medium text-right">{getDetail("Type")}</dd>
                    </div>
                  )}
                  {getDetail("Format") && (
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Format</dt>
                      <dd className="font-medium text-right">{getDetail("Format")}</dd>
                    </div>
                  )}
                  {getDetail("Episodes") && (
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Total Episode</dt>
                      <dd className="font-medium text-right">{getDetail("Episodes")}</dd>
                    </div>
                  )}
                  {getDetail("Duration") && (
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Durasi</dt>
                      <dd className="font-medium text-right">{getDetail("Duration")}</dd>
                    </div>
                  )}
                  {getDetail("Aired") && (
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Tayang</dt>
                      <dd className="font-medium text-right">{getDetail("Aired")}</dd>
                    </div>
                  )}
                  {getDetail("Aired On") && (
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Jadwal</dt>
                      <dd className="font-medium text-right">{getDetail("Aired On")}</dd>
                    </div>
                  )}
                  {getDetail("Original Network") && (
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Network</dt>
                      <dd className="font-medium text-right">{getDetail("Original Network")}</dd>
                    </div>
                  )}
                  {getDetail("Country") && (
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Negara</dt>
                      <dd className="font-medium text-right">{getDetail("Country")}</dd>
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
    </DetailErrorBoundary>
  );
}
