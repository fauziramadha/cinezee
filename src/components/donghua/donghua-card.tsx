"use client";

import Image from "next/image";
import Link from "next/link";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";

interface DonghuaCardProps {
  donghua: {
    title: string;
    poster?: string;
    slug?: string;
    status?: string;
    current_episode?: string;
    episode?: string;
    type?: string;
    source?: "s1" | "s2";
    isEpisode?: boolean;
  };
}

function decodeHtmlEntities(text: string): string {
  if (!text) return "";
  const entities: Record<string, string> = {
    "&#8217;": "'",
    "&#8216;": "'",
    "&#8220;": '"',
    "&#8221;": '"',
    "&#8211;": "-",
    "&#8212;": "—",
    "&#8230;": "...",
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&nbsp;": " ",
  };
  let decoded = text;
  for (const [entity, char] of Object.entries(entities)) {
    decoded = decoded.split(entity).join(char);
  }
  decoded = decoded.replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)));
  decoded = decoded.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  return decoded;
}

export function DonghuaCard({ donghua }: DonghuaCardProps) {
  const rawTitle = donghua.title || "Untitled";
  const title = decodeHtmlEntities(rawTitle.includes("\t") ? rawTitle.split("\t")[0] : rawTitle);
  
  const poster = donghua.poster || null;
  const status = donghua.status || "Unknown";
  const slug = (donghua.slug || "").replace(/\/$/, "");
  const currentEp = donghua.current_episode || donghua.episode || "";
  const isEpisode = donghua.isEpisode || false;

  // If isEpisode (from Latest tab), link to watch page
  // Otherwise link to detail page
  let detailHref: string;
  if (isEpisode) {
    // Episode slug goes directly to watch page
    // Use episode slug as both animeId and episodeId
    // Player will extract series slug from navigation
    detailHref = `/donghua/s1/watch/${slug}/${slug}`;
  } else {
    detailHref = `/donghua/s1/${slug}`;
  }

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
          <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-bold uppercase backdrop-blur-sm", status.toLowerCase().includes("ongoing") ? "bg-green-500/90 text-white" : status.toLowerCase().includes("completed") || status.toLowerCase().includes("selesai") ? "bg-blue-500/90 text-white" : "bg-black/70 text-white")}>{status}</span>
        </div>
        {currentEp && (
          <div className="absolute right-1.5 top-1.5">
            <span className="rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-semibold text-white backdrop-blur-sm">{currentEp}</span>
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/90 backdrop-blur-sm"><Play className="h-5 w-5 fill-white text-white" /></div>
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-2.5 pt-8">
        <h3 className="line-clamp-2 text-xs font-semibold text-white sm:text-sm">{title}</h3>
      </div>
    </Link>
  );
}
