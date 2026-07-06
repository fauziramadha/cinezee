"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import useEmblaCarousel from "embla-carousel-react";
import { Play, Star, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ComicHeroProps {
  comics: any[];
}

const SLIDE_DURATION = 8000;

export function ComicHero({ comics }: ComicHeroProps) {
  const router = useRouter();
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: "start" });
  const [selected, setSelected] = useState(0);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelected(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on("select", onSelect);
    return () => { emblaApi.off("select", onSelect); };
  }, [emblaApi, onSelect]);

  const handleProgressEnd = useCallback(() => {
    emblaApi?.scrollNext();
  }, [emblaApi]);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  if (!comics || comics.length === 0) return null;

  const heroComics = comics.slice(0, 5);

  const handleRead = (comic: any) => {
    const slug = comic.slug || (comic.link || comic.url || "").replace(/^\/(manga|detail-komik)\//, "").replace(/\/$/, "");
    router.push(`/comic/${slug}`);
  };

  return (
    <section className="relative h-[60vh] min-h-[400px] w-full overflow-hidden md:h-[75vh] lg:h-[80vh]">
      <div ref={emblaRef} className="h-full overflow-hidden">
        <div className="flex h-full">
          {heroComics.map((comic, idx) => {
            const title = comic.title || "Untitled";
            const poster = comic.thumbnail || comic.image || comic.poster || null;
            const type = comic.type || "Manga";
            const chapter = comic.chapter || "";
            const slug = comic.slug || (comic.link || comic.url || "").replace(/^\/(manga|detail-komik)\//, "").replace(/\/$/, "");

            return (
              <div key={slug || idx} className="relative min-w-0 flex-[0_0_100%]">
                <div className="absolute inset-0">
                  {poster && (
                    <Image
                      src={poster}
                      alt={title}
                      fill
                      priority={idx === 0}
                      sizes="100vw"
                      className="object-cover"
                      unoptimized
                      referrerPolicy="no-referrer"
                    />
                  )}
                </div>
                <div className="hero-gradient absolute inset-0" />
                <div className="hero-gradient-left absolute inset-0" />

                <div className="relative z-10 flex h-full items-end md:items-center">
                  <div className="w-full max-w-2xl px-4 pb-14 sm:px-6 md:pb-0 md:pl-8 lg:pl-12">
                    <div className="mb-2 flex items-center gap-2 sm:mb-3">
                      <span className="rounded bg-primary/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
                        {type}
                      </span>
                      {chapter && (
                        <span className="rounded bg-black/50 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                          {chapter}
                        </span>
                      )}
                    </div>
                    <h1 className="slide-in text-2xl font-extrabold tracking-tight text-white drop-shadow-lg sm:text-3xl md:text-5xl lg:text-6xl">
                      {title}
                    </h1>
                    <div className="mt-3 flex flex-wrap gap-2 sm:mt-6 sm:gap-3">
                      <Button
                        size="lg"
                        onClick={() => handleRead(comic)}
                        className="h-9 gap-2 bg-primary px-4 text-xs font-semibold text-primary-foreground hover:bg-primary/90 sm:h-12 sm:px-8 sm:text-base"
                      >
                        <Play className="h-4 w-4 fill-current sm:h-5 sm:w-5" />
                        Baca Sekarang
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <button onClick={scrollPrev} className="absolute left-2 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-all hover:bg-primary md:flex" aria-label="Previous slide">
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button onClick={scrollNext} className="absolute right-2 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-all hover:bg-primary md:flex" aria-label="Next slide">
        <ChevronRight className="h-5 w-5" />
      </button>

      <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 sm:bottom-4 md:bottom-6">
        {heroComics.map((_, idx) => (
          <div key={idx} className="h-1 w-8 overflow-hidden rounded-full bg-white/30 sm:w-10">
            {idx === selected && (
              <div
                key={`progress-${selected}`}
                className="h-full rounded-full bg-primary"
                style={{ width: "0%", animation: `heroProgress ${SLIDE_DURATION}ms linear forwards` }}
                onAnimationEnd={handleProgressEnd}
              />
            )}
          </div>
        ))}
      </div>

      <style>{`
        @keyframes heroProgress {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </section>
  );
}
