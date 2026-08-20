"use client";

/**
 * src/lib/use-safe-session.ts
 *
 * Safe wrapper untuk useSession (NextAuth).
 * Handle SSR + hydration mismatch dengan graceful fallback.
 */

import { useSession } from "next-auth/react";

export function useSafeSession() {
  // SAFELY destructure useSession.
  // Saat SSR/prerendering, SessionProvider belum mount, jadi useSession() return undefined.
  // `|| {}` mencegah error "Cannot destructure property 'data' of undefined".
  const { data: session, status } = useSession() || {};

  if (status === "loading") {
    return {
      data: null,
      status: "loading" as const,
    };
  }

  return {
    data: session ?? null,
    status: (status || "unauthenticated") as "authenticated" | "unauthenticated",
  };
}
