"use client";

import { X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { getYouTubeId } from "./types";

interface DetailTrailerModalProps {
  trailerUrl: string | null;
  open: boolean;
  onClose: () => void;
}

export function DetailTrailerModal({ trailerUrl, open, onClose }: DetailTrailerModalProps) {
  const youtubeId = trailerUrl ? getYouTubeId(trailerUrl) : null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[95vw] overflow-hidden rounded-xl border-0 bg-black p-0 sm:max-w-3xl md:max-w-4xl">
        <DialogTitle className="sr-only">Trailer</DialogTitle>
        <button
          onClick={onClose}
          className="absolute right-2 top-2 z-50 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition hover:bg-red-600"
          aria-label="Close trailer"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="relative aspect-video w-full bg-black">
          {youtubeId ? (
            <iframe
              src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0`}
              title="Trailer"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 h-full w-full"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-white/60">
              Trailer tidak tersedia
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
