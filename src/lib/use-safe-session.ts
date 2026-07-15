"use client";

/**
 * src/lib/use-safe-session.ts
 *
 * Safe wrapper untuk useSession (NextAuth).
 * Handle SSR + hydration mismatch dengan graceful fallback.
 */

import { useSession } from "next-auth/react";

export function useSafeSession() {
  // Gunakan useSession bawaan NextAuth.
  // Karena ini adalah hook, dia akan otomatis sinkron dengan SessionProvider
  // yang ada di ClientLayout.
  const { data: session, status } = useSession();

  // Kalau status loading, return loading (Header akan show pulse placeholder)
  if (status === "loading") {
    return {
      data: null,
      status: "loading" as const,
    };
  }

  // Kalau authenticated atau unauthenticated, return apa adanya
  return {
    data: session,
    status: status as "authenticated" | "unauthenticated",
  };
}
