import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { SessionProviderWrapper } from "@/components/providers/session-provider";
import { SplashOverlay } from "@/components/pwa/splash-screen";
import { TranslationProvider } from "@/i18n/translation-provider";
import Script from "next/script";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// ============================================================
// METADATA — SEO + PWA + Social Sharing
// ============================================================
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
  manifest: "/manifest.json",

  // === PWA Icons ===
  icons: {
    icon: [
      { url: "/icons/AC571102-A8DE-4EB8-9C21-37972F5E3346.png", type: "image/png", sizes: "any" },
    ],
    shortcut: ["/icons/AC571102-A8DE-4EB8-9C21-37972F5E3346.png"],
    apple: [
      { url: "/icons/AC571102-A8DE-4EB8-9C21-37972F5E3346.png", sizes: "180x180", type: "image/png" },
      { url: "/icons/AC571102-A8DE-4EB8-9C21-37972F5E3346.png", sizes: "192x192", type: "image/png" },
    ],
  },

  // === iOS PWA ===
  appleWebApp: {
    title: "CineStream",
    statusBarStyle: "black-translucent",
    capable: true,
    startupImage: ["/icons/AC571102-A8DE-4EB8-9C21-37972F5E3346.png"],
  },

  // === Android PWA ===
  applicationName: "CineStream",
  formatDetection: {
    telephone: false,
    address: false,
    email: false,
  },

  // === Social Sharing ===
  openGraph: {
    title: "CineStream — Watch Movies & TV Shows Free",
    description:
      "Modern streaming app for browsing and watching movies and TV shows.",
    type: "website",
    siteName: "CineStream",
    images: [
      {
        url: "/icons/AC571102-A8DE-4EB8-9C21-37972F5E3346.png",
        width: 512,
        height: 512,
        alt: "CineStream",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "CineStream",
    description: "Watch Movies & TV Shows Free",
    images: ["/icons/AC571102-A8DE-4EB8-9C21-37972F5E3346.png"],
  },
};

// ============================================================
// VIEWPORT — Mobile optimization
// ============================================================
export const viewport: Viewport = {
  themeColor: "#B20710",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

// ============================================================
// ROOT LAYOUT
// ============================================================
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        {/* === PWA Meta Tags (untuk iOS yang Next.js tidak handle otomatis) === */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="CineStream" />
        <meta name="application-name" content="CineStream" />
        <meta name="msapplication-TileColor" content="#B20710" />
        <meta name="msapplication-tap-highlight" content="no" />

        {/* === Service Worker Registration === */}
        <Script
          id="sw-register"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js', {
                    scope: '/',
                    updateViaCache: 'none'
                  })
                  .then(function(registration) {
                    console.log('[PWA] SW registered:', registration.scope);

                    // Check for updates every 60 minutes
                    setInterval(function() {
                      registration.update().catch(function(err) {
                        console.log('[PWA] Update check failed:', err);
                      });
                    }, 60 * 60 * 1000);
                  })
                  .catch(function(err) {
                    console.error('[PWA] SW registration failed:', err);
                  });

                  // Listen for new SW version
                  navigator.serviceWorker.addEventListener('controllerchange', function() {
                    console.log('[PWA] New SW activated, reload to apply changes');
                  });
                });
              }
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} antialiased bg-background text-foreground min-h-screen`}
      >
        {/* === Splash Screen Overlay === */}
        <SplashOverlay />

        {/* === Translation Provider (i18n) === */}
        <TranslationProvider>
          <SessionProviderWrapper>{children}</SessionProviderWrapper>
        </TranslationProvider>

        <Toaster />
        <SonnerToaster position="bottom-right" />
      </body>
    </html>
  );
}
