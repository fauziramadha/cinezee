"use client";

import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface ComicCardProps {
  comic: {
    title: string;
    slug?: string;
    thumbnail?: string;
    poster?: string;
    type?: string;
    genre?: string;
    status?: string;
    description?: string;
  };
}

export function ComicCard({ comic }: ComicCardProps) {
  const title = comic.title || "Untitled";
  const poster = comic.thumbnail || comic.poster || null;
  const slug = (comic.slug || "").replace(/\/$/, "");
  const type = comic.type || "Manga";

  const detailHref = `/comic/${slug}`;

  return (
    <Link
      href={detailHref}
      className="group relative flex shrink-0 flex-col overflow-hidden rounded-lg bg-card text-left transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-primary/20 hover:ring-2 hover:ring-primary/40"
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-muted">
        {poster ? (
          <Image src={poster} alt={title} fill sizes="(max-width: 640px) 45vw, 200px" className="object-cover transition-transform duration-300 group-hover:scale-110" unoptimized />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground"><span className="text-xs">No Image</span></div>
        )}
        <div className="absolute left-1.5 top-1.5">
          <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-bold uppercase backdrop-blur-sm", type === "Manhwa" ? "bg-purple-500/90 text-white" : type === "Manhua" ? "bg-orange-500/90 text-white" : "bg-blue-500/90 text-white")}>{type}</span>
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-2.5 pt-8">
        <h3 className="line-clamp-2 text-xs font-semibold text-white sm:text-sm">{title}</h3>
        {comic.genre && <p className="mt-0.5 truncate text-[10px] text-white/60">{comic.genre}</p>}
      </div>
    </Link>
  );
}
