"use client";

/**
 * src/lib/use-safe-session.ts
 *
 * Safe wrapper untuk useSession (NextAuth).
 * Handle SSR + hydration mismatch dengan graceful fallback.
 */

import { useState, useEffect } from "react";

interface SafeUser {
  id?: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role?: string;
  language?: string;
}

interface SafeSessionData {
  user?: SafeUser;
  expires?: string;
}

interface SafeSession {
  data: SafeSessionData | null;
  status: "loading" | "authenticated" | "unauthenticated";
}

export function useSafeSession(): SafeSession {
  const [session, setSession] = useState<SafeSession>({
    data: null,
    status: "unauthenticated",
  });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      try {
        const { useSession } = await import("next-auth/react");
        // Kita gak bisa langsung pakai hook di async function,
        // jadi kita fetch session dari API endpoint
        const res = await fetch("/api/auth/session");
        if (!res.ok) {
          if (mounted) {
            setSession({ data: null, status: "unauthenticated" });
            setLoaded(true);
          }
          return;
        }
        const data = await res.json();
        if (mounted) {
          if (data?.user) {
            setSession({ data, status: "authenticated" });
          } else {
            setSession({ data: null, status: "unauthenticated" });
          }
          setLoaded(true);
        }
      } catch {
        if (mounted) {
          setSession({ data: null, status: "unauthenticated" });
          setLoaded(true);
        }
      }
    }

    loadSession();

    // Poll session setiap 5 menit (refresh token check)
    const interval = setInterval(loadSession, 5 * 60 * 1000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // Selama belum loaded, status = "loading"
  if (!loaded) {
    return { data: null, status: "loading" };
  }

  return session;
}
