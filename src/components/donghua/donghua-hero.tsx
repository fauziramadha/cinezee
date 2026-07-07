"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import useEmblaCarousel from "embla-carousel-react";
import { Play, ChevronLeft, ChevronRight, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DonghuaHeroProps {
  donghuas: any[];
  source?: "s1" | "s2";
}

const SLIDE_DURATION = 8000;

export function DonghuaHero({ donghuas, source = "s1" }: DonghuaHeroProps) {
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
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi, onSelect]);

  const handleProgressEnd = useCallback(() => {
    emblaApi?.scrollNext();
  }, [emblaApi]);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  const handleSwitchServer = () => {
    const target = source === "s1" ? "/donghua/s2" : "/donghua/s1";
    router.push(target);
  };

  if (!donghuas || donghuas.length === 0) return null;

  const heroItems = donghuas.slice(0, 5);

  const handleWatch = (item: any) => {
    const rawTitle = item.title || "Untitled";
    const title = rawTitle.includes("\t") ? rawTitle.split("\t")[0] : rawTitle;
    const slug = (item.slug || item.id || "").toString().replace(/\/$/, "");
    if (!slug) return;
    const href = source === "s2" ? `/donghua/s2/${slug}` : `/donghua/s1/${slug}`;
    router.push(href);
  };

  return (
    <section className="relative h-[60vh] min-h-[400px] w-full overflow-hidden md:h-[75vh] lg:h-[80vh]">
      <div ref={emblaRef} className="h-full overflow-hidden">
        <div className="flex h-full">
          {heroItems.map((item, idx) => {
            const rawTitle = item.title || "Untitled";
            const title = rawTitle.includes("\t") ? rawTitle.split("\t")[0] : rawTitle;
            const poster =
              item.poster ||
              item.thumbnail ||
              item.image ||
              item.cover ||
              null;
            const status = item.status || item.type || "Ongoing";
            const currentEp =
              item.current_episode || item.episode || item.latest_episode || "";
            const slug = (item.slug || item.id || "").toString().replace(/\/$/, "");

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
                    />
                  )}
                </div>
                <div className="hero-gradient absolute inset-0" />
                <div className="hero-gradient-left absolute inset-0" />

                <div className="relative z-10 flex h-full items-end md:items-center">
                  <div className="w-full max-w-2xl px-4 pb-14 sm:px-6 md:pb-0 md:pl-8 lg:pl-12">
                    <div className="mb-2 flex items-center gap-2 sm:mb-3">
                      <span className="rounded bg-primary/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
                        {source === "s2" ? "Server 2" : "Server 1"}
                      </span>
                      <span className="rounded bg-black/50 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                        Donghua
                      </span>
                      <span
                        className={`rounded bg-black/50 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm ${
                          status.toLowerCase().includes("ongoing")
                            ? "border-l-2 border-green-400"
                            : status.toLowerCase().includes("completed") ||
                              status.toLowerCase().includes("selesai")
                            ? "border-l-2 border-blue-400"
                            : ""
                        }`}
                      >
                        {status}
                      </span>
                      {currentEp && (
                        <span className="rounded bg-black/50 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                          {currentEp}
                        </span>
                      )}
                    </div>
                    <h1 className="slide-in text-2xl font-extrabold tracking-tight text-white drop-shadow-lg sm:text-3xl md:text-5xl lg:text-6xl">
                      {title}
                    </h1>
                    <div className="mt-3 flex flex-wrap gap-2 sm:mt-6 sm:gap-3">
                      <Button
                        size="lg"
                        onClick={() => handleWatch(item)}
                        className="h-9 gap-2 bg-primary px-4 text-xs font-semibold text-primary-foreground hover:bg-primary/90 sm:h-12 sm:px-8 sm:text-base"
                      >
                        <Play className="h-4 w-4 fill-current sm:h-5 sm:w-5" />
                        Tonton Sekarang
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <button
        onClick={scrollPrev}
        className="absolute left-2 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-all hover:bg-primary md:flex"
        aria-label="Previous slide"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        onClick={scrollNext}
        className="absolute right-2 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-all hover:bg-primary md:flex"
        aria-label="Next slide"
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 sm:bottom-4 md:bottom-6">
        {heroItems.map((_, idx) => (
          <div
            key={idx}
            className="h-1 w-8 overflow-hidden rounded-full bg-white/30 sm:w-10"
          >
            {idx === selected && (
              <div
                key={`progress-${selected}`}
                className="h-full rounded-full bg-primary"
                style={{
                  width: "0%",
                  animation: `heroProgress ${SLIDE_DURATION}ms linear forwards`,
                }}
                onAnimationEnd={handleProgressEnd}
              />
            )}
          </div>
        ))}
      </div>

      {/* Switch Server button — bottom right */}
      <button
        onClick={handleSwitchServer}
        className="absolute bottom-4 right-4 z-20 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-md transition-all hover:bg-primary hover:text-primary-foreground sm:bottom-6 sm:right-6 sm:px-4 sm:py-2 sm:text-sm"
        aria-label="Switch server"
        title={`Switch ke ${source === "s1" ? "Server 2" : "Server 1"}`}
      >
        <ArrowRightLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        {source === "s1" ? "Server 2" : "Server 1"}
      </button>

      <style>{`
        @keyframes heroProgress {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </section>
  );
}
