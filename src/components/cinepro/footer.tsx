"use client";

import { Film, Github, Heart, Shield } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border/60 bg-card/30 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
              <Film className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm font-bold">
                Cine<span className="text-primary">Stream</span>
              </p>
              <p className="text-[10px] text-muted-foreground">
                Built with Next.js • Deploy on Cloudflare Workers
              </p>
            </div>
          </div>

          {/* Links */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <a
              href="https://github.com/cinepro-org/ui"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 transition-colors hover:text-foreground"
            >
              <Github className="h-3.5 w-3.5" />
              Inspired by CinePro
            </a>
            <span className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5" />
              No tracking
            </span>
            <span className="flex items-center gap-1.5">
              Made with <Heart className="h-3 w-3 fill-primary text-primary" /> for
              streaming
            </span>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="mt-6 rounded-md border border-border/40 bg-muted/20 p-3 text-[11px] leading-relaxed text-muted-foreground">
          <p className="font-semibold text-foreground/80">Disclaimer</p>
          <p className="mt-1">
            CineStream does not host, upload, or store any media files. All
            content is provided by third-party streaming providers via embed
            links. We have no control over the content quality, availability, or
            copyright legality of the third-party material. Users are responsible
            for verifying they have the legal right to view any streamed content.
            For DMCA or copyright concerns, please contact the respective
            streaming provider.
          </p>
        </div>
      </div>
    </footer>
  );
}
