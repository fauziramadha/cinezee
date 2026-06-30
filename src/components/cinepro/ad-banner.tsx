"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { dbAd } from "@/lib/db-ad"; // Optional: if you want client-side click tracking
import { cn } from "@/lib/utils";

interface AdBannerProps {
  position?: "home_top" | "home_middle" | "search_top";
  className?: string;
}

interface AdItem {
  id: number;
  name: string;
  image_url: string;
  click_url: string;
}

export function AdBanner({ position = "home_top", className }: AdBannerProps) {
  const [ad, setAd] = useState<AdItem | null>(null);

  useEffect(() => {
    fetch(`/api/ads?position=${position}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.ads && data.ads.length > 0) {
          // Ambil 1 iklan random dari list yang aktif
          const randomAd = data.ads[Math.floor(Math.random() * data.ads.length)];
          setAd(randomAd);
        }
      })
      .catch(() => {});
  }, [position]);

  // Tracking klik (fire and forget)
  const handleClick = () => {
    if (ad) {
      fetch("/api/ads", { method: "POST", body: JSON.stringify({ id: ad.id, action: "click" }) }).catch(() => {});
    }
  };

  if (!ad) return null;

  return (
    <div className={cn("relative w-full overflow-hidden rounded-xl border border-border", className)}>
      <a
        href={ad.click_url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        className="block"
      >
        <div className="relative aspect-[16/5] w-full sm:aspect-[20/5] md:aspect-[25/5]">
          <Image
            src={ad.image_url}
            alt={ad.name}
            fill
            className="object-cover"
            unoptimized
            sizes="(max-width: 768px) 100vw, 1200px"
          />
        </div>
      </a>
    </div>
  );
}
