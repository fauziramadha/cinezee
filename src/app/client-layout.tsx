"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// SessionProvider dipakai dynamic ssr:false agar hook useSession tidak dieval saat build SSG
const SessionProviderWrapper = dynamic(
  () => import("@/components/providers/session-provider").then(mod => mod.SessionProviderWrapper),
  { 
    ssr: false,
    loading: () => (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }
);

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return <SessionProviderWrapper>{children}</SessionProviderWrapper>;
}
