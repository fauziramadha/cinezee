"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, LogIn, Sparkles, Github, Mail, Loader2 } from "lucide-react";
import { useAppStore } from "@/lib/store";

export function AuthModal() {
  const { authModalOpen, setAuthModalOpen } = useAppStore();
  const [loading, setLoading] = useState<null | "google" | "guest">(null);

  // Kalau URL punya ?error=OAuthCallback, tampilkan pesan error
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "OAuthCallback") {
      console.error("[Auth] OAuth callback error");
    }
  }, []);

  const handleGoogleLogin = async () => {
    setLoading("google");
    try {
      // Dynamic import next-auth/react
      const { signIn } = await import("next-auth/react");
      await signIn("google", { callbackUrl: "/" });
    } catch (err) {
      console.error("[Auth] Google login error:", err);
      setLoading(null);
    }
  };

  const handleGuestLogin = () => {
    setLoading("guest");
    setTimeout(() => {
      setLoading(null);
      setAuthModalOpen(false);
      window.location.href = "/";
    }, 500);
  };

  return (
    <Dialog open={authModalOpen} onOpenChange={setAuthModalOpen}>
      <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Login ke CineStream</DialogTitle>
          <DialogDescription>
            Login untuk menyimpan watchlist, rating, dan komentar
          </DialogDescription>
        </DialogHeader>

        {/* Close button */}
        <button
          onClick={() => setAuthModalOpen(false)}
          className="absolute right-3 top-3 z-50 flex h-9 w-9 items-center justify-center rounded-full bg-black/80 text-white backdrop-blur-sm transition-colors hover:bg-primary"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Hero */}
        <div className="relative flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-primary/20 to-transparent p-8 pt-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary">
            <LogIn className="h-7 w-7 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Selamat Datang di CineStream</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Login untuk menyimpan watchlist, rating, dan komentar
            </p>
          </div>
        </div>

        {/* Login options */}
        <div className="space-y-3 p-6">
          {/* Google — REAL LOGIN */}
          <Button
            onClick={handleGoogleLogin}
            disabled={loading !== null}
            variant="outline"
            className="flex h-11 w-full items-center justify-center gap-2 border-border text-sm font-medium hover:bg-muted"
          >
            {loading === "google" ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
            )}
            <span>
              {loading === "google" ? "Menghubungkan..." : "Lanjutkan dengan Google"}
            </span>
          </Button>

          {/* Divider */}
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-background px-2 text-xs text-muted-foreground">
                atau
              </span>
            </div>
          </div>

          {/* Guest mode */}
          <Button
            onClick={handleGuestLogin}
            disabled={loading !== null}
            variant="ghost"
            className="flex h-11 w-full items-center justify-center gap-2 text-sm font-medium text-muted-foreground hover:bg-muted"
          >
            <Sparkles className="h-4 w-4" />
            <span>
              {loading === "guest" ? "Loading..." : "Lanjut sebagai Tamu"}
            </span>
          </Button>

          {/* Email (placeholder) */}
          <div className="pt-2">
            <div className="flex h-11 w-full items-center justify-center gap-2 rounded-md border border-dashed border-border text-sm text-muted-foreground">
              <Mail className="h-4 w-4" />
              <span>Login dengan Email (segera hadir)</span>
            </div>
          </div>

          {/* Terms */}
          <p className="pt-4 text-center text-[10px] leading-relaxed text-muted-foreground">
            Dengan melanjutkan, Anda menyetujui{" "}
            <a href="/terms" className="underline hover:text-foreground">
              Ketentuan Layanan
            </a>{" "}
            dan{" "}
            <a href="/privacy" className="underline hover:text-foreground">
              Kebijakan Privasi
            </a>
            .
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
