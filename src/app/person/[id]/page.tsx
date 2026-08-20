"use client";

import { useEffect, useState, Suspense } from "react";
import Image from "next/image";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, Film, Tv, Calendar, MapPin, ChevronDown } from "lucide-react";
import { Header } from "@/components/cinepro/header";
import { Footer } from "@/components/cinepro/footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DetailModal } from "@/components/cinepro/detail-modal";
import { PlayerModal } from "@/components/cinepro/player-modal";
import { SearchModal } from "@/components/cinepro/search-modal";
import { AuthModal } from "@/components/cinepro/auth-modal";
import { useAppStore, type SelectedMedia } from "@/lib/store";
import { getImageUrl } from "@/lib/tmdb";

interface PersonCredit {
  id: number;
  title?: string;
  name?: string;
  character?: string;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  poster_path: string | null;
  media_type: "movie" | "tv";
}

interface PersonDetail {
  id: number;
  name: string;
  biography: string;
  birthday: string | null;
  deathday: string | null;
  place_of_birth: string | null;
  profile_path: string | null;
  known_for_department: string;
  combined_credits?: {
    cast: PersonCredit[];
  };
}

const ITEMS_PER_PAGE = 20; // Load 20 judul per halaman

function PersonContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const setSelectedMedia = useAppStore((s) => s.setSelectedMedia);

  const personId = params?.id as string;
  const [person, setPerson] = useState<PersonDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // State untuk Load More
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

  const returnUrl = searchParams.get("return");

  useEffect(() => {
    if (!personId) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/person/${personId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch");
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setPerson(data);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [personId]);

  const handleMovieClick = (credit: PersonCredit) => {
    const mediaType = credit.media_type || (credit.title ? "movie" : "tv");
    const title = credit.title || credit.name || "Untitled";
    const selected: SelectedMedia = {
      id: credit.id,
      type: mediaType,
      title,
      posterPath: credit.poster_path,
      backdropPath: null,
    };
    setSelectedMedia(selected);
  };

  const handleBack = () => {
    if (returnUrl) {
      router.push(`/?${returnUrl}`);
    } else {
      router.back();
    }
  };

  // Sort & dedup filmography
  const filmography = (person?.combined_credits?.cast || [])
    .filter((c) => c.poster_path)
    .sort((a, b) => {
      const dateA = a.release_date || a.first_air_date || "";
      const dateB = b.release_date || b.first_air_date || "";
      return dateB.localeCompare(dateA);
    })
    .filter((c, idx, self) =>
      idx === self.findIndex((t) => t.id === c.id && t.media_type === c.media_type)
    );

  // Hanya tampilkan sesuai visibleCount (20, 40, 60, dst)
  const visibleFilmography = filmography.slice(0, visibleCount);

  const calculateAge = (birthday: string, deathday: string | null) => {
    if (!birthday) return null;
    const birth = new Date(birthday);
    const end = deathday ? new Date(deathday) : new Date();
    const age = Math.floor((end.getTime() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    return age;
  };

  return (
    <main className="min-h-screen bg-background">
      <Header />

      {/* === HERO SECTION === */}
      <div className="relative pt-16">
        {loading ? (
          <div className="flex h-[60vh] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="flex h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="secondary" size="sm" onClick={handleBack}>
              Go Back
            </Button>
          </div>
        ) : person ? (
          <>
            {/* Backdrop gradient */}
            <div className="absolute inset-0 overflow-hidden">
              {person.profile_path && (
                <div className="relative h-full w-full">
                  <Image
                    src={getImageUrl(person.profile_path, "original")}
                    alt={person.name}
                    fill
                    priority
                    className="object-cover opacity-20 blur-sm"
                    unoptimized
                  />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/40" />
            </div>

            {/* Content */}
            <div className="relative z-10 mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
              <button
                onClick={handleBack}
                className="mb-6 flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>

              <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
                <div className="mx-auto w-40 shrink-0 sm:mx-0 sm:w-48 md:w-56">
                  <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-border bg-muted shadow-2xl">
                    {person.profile_path ? (
                      <Image
                        src={getImageUrl(person.profile_path, "w500")}
                        alt={person.name}
                        fill
                        priority
                        className="object-cover"
                        unoptimized
                        sizes="(max-width: 640px) 160px, 224px"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Film className="h-12 w-12 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <h1 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">
                    {person.name}
                  </h1>

                  {person.known_for_department && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {person.known_for_department}
                      </Badge>
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
                    {person.birthday && (
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-4 w-4 shrink-0" />
                        <span>
                          {new Date(person.birthday).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                          {calculateAge(person.birthday, person.deathday) && (
                            <span className="ml-1 text-xs">
                              ({calculateAge(person.birthday, person.deathday)} years old
                              {person.deathday ? " old at death" : ""})
                            </span>
                          )}
                        </span>
                      </div>
                    )}

                    {person.place_of_birth && (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-4 w-4 shrink-0" />
                        <span className="truncate">{person.place_of_birth}</span>
                      </div>
                    )}
                  </div>

                  {person.biography && (
                    <div className="mt-6">
                      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                        Biography
                      </h2>
                      <p className="max-w-3xl whitespace-pre-line text-sm leading-relaxed text-foreground/90 sm:text-base">
                        {person.biography}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>

      {/* === FILMOGRAPHY === */}
      {!loading && !error && person && filmography.length > 0 && (
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-4 flex items-center gap-2">
            <Film className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold sm:text-xl">Filmography</h2>
            <span className="text-sm text-muted-foreground">
              ({filmography.length} titles)
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
            {visibleFilmography.map((credit) => {
              const title = credit.title || credit.name || "Untitled";
              const year = (credit.release_date || credit.first_air_date || "").split("-")[0];
              const rating = credit.vote_average?.toFixed(1) || "N/A";

              return (
                <button
                  key={`${credit.id}-${credit.media_type}`}
                  onClick={() => handleMovieClick(credit)}
                  className="group relative aspect-[2/3] overflow-hidden rounded-lg bg-card text-left transition-all hover:ring-2 hover:ring-primary"
                >
                  {credit.poster_path ? (
                    <Image
                      src={getImageUrl(credit.poster_path, "w500")}
                      alt={title}
                      fill
                      sizes="(max-width: 640px) 33vw, 200px"
                      className="object-cover transition-transform group-hover:scale-105"
                      unoptimized
                      loading="lazy" // Lazy load gambar untuk hemat bandwidth
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-muted">
                      {credit.media_type === "tv" ? (
                        <Tv className="h-8 w-8 text-muted-foreground" />
                      ) : (
                        <Film className="h-8 w-8 text-muted-foreground" />
                      )}
                    </div>
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

                  <div className="absolute left-1.5 top-1.5">
                    <span className="rounded bg-primary/90 px-1 text-[7px] font-bold uppercase text-primary-foreground backdrop-blur-sm">
                      {credit.media_type}
                    </span>
                  </div>

                  <div className="absolute right-1.5 top-1.5">
                    <span className="flex items-center gap-0.5 rounded bg-black/60 px-1 py-0.5 text-[7px] font-semibold text-yellow-400 backdrop-blur-sm">
                      ★ {rating}
                    </span>
                  </div>

                  {credit.character && (
                    <div className="absolute left-1.5 right-1.5 top-7">
                      <span className="line-clamp-1 text-[8px] font-medium text-white/80">
                        as {credit.character}
                      </span>
                    </div>
                  )}

                  <div className="absolute bottom-0 left-0 right-0 p-1.5">
                    <h3 className="line-clamp-2 text-[10px] font-semibold text-white sm:text-xs">
                      {title}
                    </h3>
                    {year && (
                      <p className="mt-0.5 text-[8px] text-white/60">{year}</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* === LOAD MORE BUTTON === */}
          {visibleCount < filmography.length && (
            <div className="mt-8 flex justify-center">
              <Button
                variant="outline"
                onClick={() => setVisibleCount(visibleCount + ITEMS_PER_PAGE)}
                className="gap-2"
              >
                Load More ({filmography.length - visibleCount} remaining)
                <ChevronDown className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}

      <Footer />

      {/* Modals */}
      <SearchModal />
      <DetailModal />
      <PlayerModal />
      <AuthModal />
    </main>
  );
}

// ============================================================
// WRAPPER with Suspense (required for useSearchParams)
// ============================================================
export default function PersonPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-background">
          <Header />
          <div className="flex h-[60vh] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </main>
      }
    >
      <PersonContent />
    </Suspense>
  );
}
