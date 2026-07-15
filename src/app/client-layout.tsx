"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { AuthModal } from "@/components/cinepro/auth-modal";

/**
 * FIX: "This page couldn't load" on iPhone Safari
 *
 * PROBLEM:
 *   Direct import of SessionProviderWrapper caused NextAuth's SessionProvider
 *   to render during SSR on Cloudflare Workers. With React 19, this throws
 *   "Invalid hook call" → Worker crashes → Safari shows "This page couldn't load".
 *
 *   Note: "use client" does NOT prevent SSR — it only marks the component as
 *   client-compatible. Server still renders it during SSR.
 *
 * SOLUTION: Two-phase mounting
 *   1. SSR + first client render: render children WITHOUT SessionProvider
 *      → Server returns valid HTML with content (no crash, no blank screen)
 *   2. After hydration (useEffect): wrap with SessionProvider via dynamic import
 *      → Auth works normally on client side
 */

const SessionProviderWrapper = dynamic(
  () =>
    import("@/components/providers/session-provider").then(
      (mod) => mod.SessionProviderWrapper
    ),
  {
    ssr: false,
    loading: () => null,
  }
);

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Phase 1: SSR + initial client hydration — render children directly
  if (!mounted) {
    return <>{children}</>;
  }

  // Phase 2: After mount — wrap with SessionProvider (client-only)
  return (
    <SessionProviderWrapper>
      {children}
      <AuthModal />
    </SessionProviderWrapper>
  );
}
