"use client";

import { Header } from "@/components/cinepro/header";
import { Footer } from "@/components/cinepro/footer";
import { SearchModal } from "@/components/cinepro/search-modal";
import { DetailModal } from "@/components/cinepro/detail-modal";
import { PlayerModal } from "@/components/cinepro/player-modal";
import { AuthModal } from "@/components/cinepro/auth-modal";
import { BookOpen, ArrowLeft } from "lucide-react";

export function NovelContent() {
  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8 pt-24">
        <a
          href="/"
          className="mb-4 inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke Beranda
        </a>

        <div className="flex flex-col items-center justify-center gap-6 py-20 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
            <BookOpen className="h-10 w-10 text-primary" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold sm:text-3xl">Novel</h1>
            <p className="text-sm text-muted-foreground max-w-md">
              Fitur novel sedang dalam pengembangan. Kami akan segera hadirkan
              ribuan novel, light novel, dan web novel untuk dibaca gratis.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4 max-w-md">
            <p className="text-xs text-muted-foreground">
              📚 Coming Soon
            </p>
            <p className="mt-1 text-sm font-medium">
              Stay tuned for updates!
            </p>
          </div>
        </div>
      </div>
      <Footer />
      <SearchModal />
      <DetailModal />
      <PlayerModal />
      <AuthModal />
    </main>
  );
}
