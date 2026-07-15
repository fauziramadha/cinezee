"use client";

/**
 * src/components/providers.tsx
 *
 * Client-side providers wrapper.
 * SessionProvider WAJIB ada supaya useSession() jalan.
 */

import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
