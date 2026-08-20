"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

/**
 * NextAuth Session Provider
 *
 * Wraps the entire app so any component can use:
 *   import { useSession, signIn, signOut } from "next-auth/react"
 *
 * Usage in layout.tsx:
 *   <SessionProvider>
 *     {children}
 *   </SessionProvider>
 */

export function SessionProviderWrapper({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
