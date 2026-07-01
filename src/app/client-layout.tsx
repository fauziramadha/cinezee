"use client";

import dynamic from "next/dynamic";

// SessionProvider dipakai dynamic ssr:false agar hook useSession tidak dieval saat build SSG
const SessionProviderWrapper = dynamic(
  () => import("@/components/providers/session-provider").then(mod => mod.SessionProviderWrapper),
  { 
    ssr: false,
    loading: () => null 
  }
);

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return <SessionProviderWrapper>{children}</SessionProviderWrapper>;
}
