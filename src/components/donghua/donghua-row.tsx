"use client";

import { useRef } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DonghuaCard } from "@/components/donghua/donghua-card";

interface DonghuaRowProps {
  title: string;
  donghuas: any[];
  href?: string;
  source?: "s1" | "s2";
  isEpisode?: boolean;
}

export function DonghuaRow({
  title,
  donghuas,
  href,
  source = "s1",
  isEpisode = false,
}: DonghuaRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.clientWidth * 0.8;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  if (!donghuas || donghuas.length === 0) return null;

  return (
    <section className="group/row relative">
      <div className="mb-3 flex items-center justify-between px-4 sm:px-6 lg:px-8">
        <h2 className="text-base font-bold tracking-tight sm:text-lg md:text-xl">
          {title}
        </h2>
        <div className="flex items-center gap-2">
          {href && (
            <Link
              href={href}
              className="text-xs text-primary transition-colors hover:text-primary/80 sm:text-sm"
            >
              Lihat lebih banyak
            </Link>
          )}
          <div className="hidden gap-1 sm:flex">
            <button
              onClick={() => scroll("left")}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-muted/60 text-muted-foreground transition-all hover:bg-primary hover:text-primary-foreground sm:h-8 sm:w-8"
              aria-label="Scroll left"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => scroll("right")}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-muted/60 text-muted-foreground transition-all hover:bg-primary hover:text-primary-foreground sm:h-8 sm:w-8"
              aria-label="Scroll right"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="content-row flex gap-3 overflow-x-auto scroll-smooth px-4 pb-2 sm:px-6 lg:px-8"
        style={{ scrollbarWidth: "none" }}
      >
        {donghuas.map((item, idx) => {
          const rawTitle = item.title || "Untitled";
          const title = rawTitle.includes("\t") ? rawTitle.split("\t")[0] : rawTitle;
          const slug = (item.slug || item.id || "").toString().replace(/\/$/, "");
          return (
            <div
              key={slug || idx}
              className="w-28 shrink-0 sm:w-32 md:w-36"
            >
              <DonghuaCard
                donghua={{
                  title,
                  poster:
                    item.poster ||
                    item.thumbnail ||
                    item.image ||
                    item.cover ||
                    null,
                  slug,
                  status: item.status || item.type || "Unknown",
                  current_episode:
                    item.current_episode ||
                    item.episode ||
                    item.latest_episode ||
                    "",
                  type: item.type || "TV",
                  source,
                  isEpisode,
                }}
              />
            </div>
          );
        })}
        <div className="w-1 shrink-0" />
      </div>
    </section>
  );
}
