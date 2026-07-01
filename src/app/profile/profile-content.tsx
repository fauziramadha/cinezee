"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Header } from "@/components/cinepro/header";
import { Footer } from "@/components/cinepro/footer";
import { SearchModal } from "@/components/cinepro/search-modal";
import { DetailModal } from "@/components/cinepro/detail-modal";
import { PlayerModal } from "@/components/cinepro/player-modal";
import { AuthModal } from "@/components/cinepro/auth-modal";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Bookmark, History } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ProfileContent() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </main>
    );
  }

  if (!session?.user) return null;

  const user = session.user;
  const initial = user.name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || "U";

  return (
    <main className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto max-w-4xl px-4 py-8 pt-24">
        <h1 className="mb-6 text-2xl font-bold sm:text-3xl">Profil Saya</h1>
        
        <div className="flex flex-col items-center gap-6 rounded-xl border border-border bg-card p-6 sm:flex-row sm:items-start">
          <Avatar className="h-24 w-24 border-2 border-primary">
            <AvatarImage src={user.image || undefined} />
            <AvatarFallback className="bg-primary/20 text-3xl font-bold text-primary">{initial}</AvatarFallback>
          </Avatar>
          
          <div className="flex-1 text-center sm:text-left">
            <h2 className="text-xl font-bold sm:text-2xl">{user.name || "User"}</h2>
            <p className="text-muted-foreground">{user.email}</p>
            
            <div className="mt-4 flex flex-wrap justify-center gap-6 sm:justify-start">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Role</p>
                <p className="font-semibold capitalize">{user.role}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Language</p>
                <p className="font-semibold uppercase">{user.language}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <button 
            onClick={() => router.push("/watchlist")}
            className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Bookmark className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">Watchlist</h3>
              <p className="text-sm text-muted-foreground">Lihat film yang sudah disimpan</p>
            </div>
          </button>

          <button 
            onClick={() => router.push("/history")}
            className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <History className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">Riwayat Tonton</h3>
              <p className="text-sm text-muted-foreground">Lihat film yang pernah ditonton</p>
            </div>
          </button>
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
