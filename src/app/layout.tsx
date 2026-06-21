import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CineStream — Watch Movies & TV Shows Free",
  description:
    "Modern, open-source streaming app for browsing and watching movies and TV shows. Built with Next.js, deployed on Cloudflare Workers.",
  keywords: [
    "movies",
    "tv shows",
    "streaming",
    "free movies",
    "watch online",
    "cinepro",
    "next.js",
    "cloudflare workers",
  ],
  authors: [{ name: "CineStream" }],
  openGraph: {
    title: "CineStream — Watch Movies & TV Shows Free",
    description:
      "Modern streaming app for browsing and watching movies and TV shows.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "CineStream",
    description: "Watch Movies & TV Shows Free",
  },
};

export const viewport = {
  themeColor: "#212121",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} antialiased bg-background text-foreground min-h-screen`}
      >
        {children}
        <Toaster />
        <SonnerToaster position="bottom-right" />
      </body>
    </html>
  );
}
