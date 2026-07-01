"use client";

import dynamic from "next/dynamic";

// ssr: false memaksa Next.js melewati halaman ini saat build (SSG)
// Halaman akan dirender murni di sisi client (browser)
const WatchlistContent = dynamic(() => import("./watchlist-content"), { ssr: false });

export default function WatchlistPage() {
  return <WatchlistContent />;
}
