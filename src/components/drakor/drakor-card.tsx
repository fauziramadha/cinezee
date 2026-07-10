"use client";

import Image from "next/image";
import Link from "next/link";
import { Play, Tv } from "lucide-react";
import { cn } from "@/lib/utils";

interface DrakorCardProps {
  drakor: {
    id?: string;
    slug?: string;
    title: string;
    imageUrl?: string | null;
    poster?: string | null;
    thumbnail?: string | null;
    status?: string;
    episode?: string;
    current_episode?: string;
    type?: string;
    year?: string;
  };
}

export function DrakorCard({ drakor }: DrakorCardProps) {
  const title = drakor.title || "Untitled";
  const rawPoster = drakor.imageUrl || drakor.poster || drakor.thumbnail || null;
  // FIX: Route all images through proxy to bypass hotlink protection
  const poster = rawPoster ? `/api/proxy-image?url=${encodeURIComponent(rawPoster)}` : null;
  const slug = (drakor.id || drakor.slug || "").toString().replace(/\/+$/, "").trim();
  const status = drakor.status || "Ongoing";
  const episode = drakor.episode || drakor.current_episode || "";
  const year = drakor.year || "";
  const type = drakor.type || "Drama Korea";

  const detailHref = slug ? `/drakor/${slug}` : "#";

  return (
    <Link
      href={detailHref}
      className="group relative flex w-full flex-col overflow-hidden rounded-lg bg-card text-left transition-all duration-300 hover:scale-[1.03] hover:shadow-2xl hover:shadow-primary/20 hover:ring-2 hover:ring-primary/40"
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-muted">
        {poster ? (
          <Image
            src={poster}
            alt={title}
            fill
            sizes="(max-width: 640px) 33vw, (max-width: 1024px) 20vw, 16vw"
            className="object-cover transition-transform duration-300 group-hover:scale-110"
            unoptimized
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Tv className="h-12 w-12" />
          </div>
        )}

        {/* Status badge */}
        <div className="absolute left-1.5 top-1.5">
          <span
            className={cn(
              "rounded px-1.5 py-0.5 text-[9px] font-bold uppercase backdrop-blur-sm",
              status.toLowerCase().includes("ongoing")
                ? "bg-green-500/90 text-white"
                : status.toLowerCase().includes("completed") ||
                  status.toLowerCase().includes("end")
                ? "bg-blue-500/90 text-white"
                : "bg-pink-500/90 text-white"
            )}
          >
            {status}
          </span>
        </div>

        {/* Episode badge */}
        {episode && (
          <div className="absolute right-1.5 top-1.5">
            <span className="rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-semibold text-white backdrop-blur-sm">
              {episode}
            </span>
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/90 backdrop-blur-sm">
            <Play className="h-5 w-5 fill-white text-white" />
          </div>
        </div>
      </div>

      {/* Title */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-2.5 pt-8">
        <h3 className="line-clamp-2 text-xs font-semibold text-white sm:text-sm">
          {title}
        </h3>
        {year && (
          <p className="mt-0.5 truncate text-[10px] text-white/60">{year}</p>
        )}
      </div>
    </Link>
  );
}
