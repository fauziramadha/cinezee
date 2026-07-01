"use client";

import { SessionProviderWrapper } from "@/components/providers/session-provider";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return <SessionProviderWrapper>{children}</SessionProviderWrapper>;
}
