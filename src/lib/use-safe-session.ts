"use client";

import { useSession } from "next-auth/react";
import type { Session } from "next-auth";

interface SafeSessionResult {
  data: Session | null;
  status: "loading" | "authenticated" | "unauthenticated";
}

/**
 * Safe wrapper for useSession() that handles undefined return.
 *
 * PROBLEM:
 *   During SSG prerender, SessionProvider is not mounted yet (ssr:false),
 *   so useSession() returns undefined. Destructuring undefined throws:
 *   "Cannot destructure property 'data' of 'undefined'"
 *
 * SOLUTION:
 *   This wrapper always returns an object, never undefined.
 */
export function useSafeSession(): SafeSessionResult {
  try {
    const result = useSession() as any;
    if (!result) {
      return { data: null, status: "unauthenticated" };
    }
    return {
      data: result.data ?? null,
      status: result.status ?? "unauthenticated",
    };
  } catch {
    return { data: null, status: "unauthenticated" };
  }
}
