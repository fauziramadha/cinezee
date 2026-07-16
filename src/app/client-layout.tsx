"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { AuthModal } from "@/components/cinepro/auth-modal";
import { SearchModal } from "@/components/cinepro/search-modal";
import { DetailModal } from "@/components/cinepro/detail-modal";
import { PlayerModal } from "@/components/cinepro/player-modal";

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

  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <SessionProviderWrapper>
      {children}
      {/* Render modals globally supaya jalan di semua halaman */}
      <AuthModal />
      <SearchModal />
      <DetailModal />
      <PlayerModal />
    </SessionProviderWrapper>
  );
}
