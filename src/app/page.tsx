"use client";

import dynamic from "next/dynamic";

// ssr: false memaksa Next.js melewati halaman ini saat build (SSG)
// Halaman akan dirender murni di sisi client (browser)
const HomeContent = dynamic(() => import("./home-content"), { ssr: false });

export default function Home() {
  return <HomeContent />;
}
