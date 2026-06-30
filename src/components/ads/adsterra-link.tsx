"use client";

import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface AdsterraLinkProps {
  label?: string;
  className?: string;
  variant?: "button" | "link";
}

/**
 * AdsterraLink - Direct link ad
 * - Opens in new tab (doesn't interfere with navigation)
 * - Can be used as button or text link
 * - Non-intrusive: clearly labeled
 */
export function AdsterraLink({
  label = "Watch in HD",
  className,
  variant = "button",
}: AdsterraLinkProps) {
  const [url, setUrl] = useState("");

  useEffect(() => {
    fetch("/api/ads/config")
      .then((res) => res.json())
      .then((data) => {
        if (data.adsterra?.direct_link) {
          setUrl(data.adsterra.direct_link);
        }
      })
      .catch(() => {});
  }, []);

  if (!url) return null;

  if (variant === "link") {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className={cn("text-xs text-muted-foreground hover:text-primary", className)}
      >
        {label}
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className={cn(
        "flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-all hover:border-primary hover:text-primary",
        className
      )}
    >
      <ExternalLink className="h-3.5 w-3.5" />
      {label}
    </a>
  );
}
