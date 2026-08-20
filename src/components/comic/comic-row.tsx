"use client";

import { useRef } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ComicCard } from "@/components/comic/comic-card";

interface ComicRowProps {
  title: string;
  comics: any[];
  href: string;
}

export function ComicRow({ title, comics, href }: ComicRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.clientWidth * 0.8;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  if (!comics || comics.length === 0) return null;

  return (
    <section className="group/row relative">
      <div className="mb-3 flex items-center justify-between px-4 sm:px-6 lg:px-8">
        <h2 className="text-base font-bold tracking-tight sm:text-lg md:text-xl">
          {title}
        </h2>
        <div className="flex items-center gap-2">
          <Link
            href={href}
            className="text-xs text-primary transition-colors hover:text-primary/80 sm:text-sm"
          >
            Lihat lebih banyak
          </Link>
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
        {/* FIX: Wrap ComicCard in a div with fixed width for horizontal scrolling */}
        {comics.map((comic, idx) => (
          <div key={comic.slug || idx} className="w-28 shrink-0 sm:w-32 md:w-36">
            <ComicCard comic={comic} />
          </div>
        ))}
        <div className="w-1 shrink-0" />
      </div>
    </section>
  );
}
