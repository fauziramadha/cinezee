"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// ssr: false memaksa Next.js melewati halaman ini saat build (SSG)
// Loading fallback diberikan agar browser tidak mengira halaman blank
const HomeContent = dynamic(() => import("./home-content"), { 
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
    </div>
  )
});

export default function Home() {
  return <HomeContent />;
}
