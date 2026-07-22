"use client";

import { getImageUrl } from "@/lib/tmdb";

export function CastList({ cast }: { cast: any[] }) {
  if (!cast || cast.length === 0) return null;

  return (
    <div className="mt-6">
      <h3 className="mb-3 text-sm font-bold text-white sm:text-base">Top Cast</h3>
      <div className="flex gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {cast.map((p) => (
          <div key={p.id} className="w-20 shrink-0 text-center sm:w-24">
            <div className="relative mx-auto mb-2 h-20 w-20 overflow-hidden rounded-full bg-zinc-800 ring-2 ring-transparent transition-all hover:ring-red-600 sm:h-24 sm:w-24">
              {p.profile_path ? (
                <img
                  src={getImageUrl(p.profile_path, "w185")}
                  alt={p.name}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-zinc-500 text-xs">No Img</div>
              )}
            </div>
            <p className="truncate text-xs font-medium text-white">{p.name}</p>
            <p className="truncate text-[10px] text-zinc-400">{p.character}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
