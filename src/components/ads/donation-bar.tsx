"use client";

import { useEffect, useState } from "react";
import { X, Heart } from "lucide-react";

// Use sessionStorage so the bar shows once per browser session
// (every time the user opens the website fresh, it shows again)
const SESSION_KEY = "cinestream_donation_shown";
const SHOW_DELAY = 3000; // Show after 3 seconds

export function DonationBar() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Check if already shown in this browser session
  useEffect(() => {
    try {
      const shown = sessionStorage.getItem(SESSION_KEY);
      if (shown) {
        setDismissed(true);
      }
    } catch {}
  }, []);

  // Show after delay (only if not already shown this session)
  useEffect(() => {
    if (dismissed) return;
    const timer = setTimeout(() => {
      setVisible(true);
      try {
        sessionStorage.setItem(SESSION_KEY, "1");
      } catch {}
    }, SHOW_DELAY);
    return () => clearTimeout(timer);
  }, [dismissed]);

  // Auto-hide when player modal opens
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const playerOpen = document.querySelector("[data-player-modal]");
      if (playerOpen) {
        setVisible(false);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    setDismissed(true);
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {}
  };

  if (!visible || dismissed) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{
        background: "rgba(0, 0, 0, 0.85)",
        backdropFilter: "blur(4px)",
        animation: "donationFadeIn 0.3s ease-out",
      }}
      onClick={handleDismiss}
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{
          animation: "donationSlideUp 0.4s ease-out",
        }}
      >
        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white/70 transition hover:bg-black/80 hover:text-white"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-2 border-b border-white/10 bg-gradient-to-r from-red-600/20 to-transparent p-4">
          <Heart className="h-5 w-5 fill-red-500 text-red-500" />
          <h2 className="text-lg font-bold text-white">Dukung CineStream</h2>
        </div>

        {/* QR Code Image */}
        <div className="flex justify-center p-6 pb-4">
          <img
            src="/socialbar.jpg"
            alt="QR Code Donasi"
            className="h-64 w-auto rounded-lg object-contain"
            style={{ maxHeight: "256px" }}
          />
        </div>

        {/* Info text */}
        <div className="px-6 pb-6 text-center">
          <p className="text-sm leading-relaxed text-white/80">
            Bantu kami untuk tetap gratis &amp; tanpa iklan, agar semangat untuk
            selalu update dan maintenance server berkala.
          </p>
          <button
            onClick={handleDismiss}
            className="mt-4 w-full rounded-lg bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-700 active:scale-95"
          >
            Mengerti
          </button>
        </div>
      </div>

      <style>{`
        @keyframes donationFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes donationSlideUp {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
}
