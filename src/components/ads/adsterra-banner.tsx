"use client";

import { useEffect, useState } from "react";
import { X, ExternalLink } from "lucide-react";

interface AdsterraConfig {
  direct_link: string | null;
  isPremium: boolean;
}

const DISMISS_KEY = "cinestream_adsterra_dismissed";
const DISMISS_DURATION = 24 * 60 * 60 * 1000; // 24 jam
const SHOW_DELAY = 3000; // Muncul setelah 3 detik

export function AdsterraBanner() {
  const [config, setConfig] = useState<AdsterraConfig | null>(null);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // === Fetch config dari API ===
  useEffect(() => {
    fetch("/api/ads/config")
      .then((res) => res.json())
      .then((data) => {
        setConfig({
          direct_link: data.adsterra?.direct_link || null,
          isPremium: !!data.isPremium,
        });
      })
      .catch(() => setConfig(null));
  }, []);

  // === Cek apakah user sudah dismiss banner dalam 24 jam terakhir ===
  useEffect(() => {
    try {
      const dismissedAt = localStorage.getItem(DISMISS_KEY);
      if (dismissedAt) {
        const elapsed = Date.now() - parseInt(dismissedAt, 10);
        if (elapsed < DISMISS_DURATION) {
          setDismissed(true);
        } else {
          localStorage.removeItem(DISMISS_KEY);
        }
      }
    } catch {}
  }, []);

  // === Tampilkan banner setelah delay (kalau memenuhi syarat) ===
  useEffect(() => {
    // Syarat tampil:
    // - Config sudah loaded
    // - Bukan premium user
    // - Ada direct_link
    // - Belum di-dismiss
    if (!config || config.isPremium || !config.direct_link || dismissed) {
      return;
    }

    const timer = setTimeout(() => {
      setVisible(true);
    }, SHOW_DELAY);

    return () => clearTimeout(timer);
  }, [config, dismissed]);

  // === Auto-hide saat player modal terbuka ===
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const playerOpen = document.querySelector("[data-player-modal]");
      if (playerOpen) {
        setVisible(false);
      } else if (config && !config.isPremium && config.direct_link && !dismissed) {
        // Tampilkan lagi kalau player ditutup (dengan delay)
        const timer = setTimeout(() => setVisible(true), 1000);
        return () => clearTimeout(timer);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [config, dismissed]);

  // === Handle dismiss ===
  const handleDismiss = () => {
    setVisible(false);
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, Date.now().toString());
    } catch {}
  };

  // === Handle click (buka Adsterra URL di tab baru) ===
  const handleClick = () => {
    if (config?.direct_link) {
      window.open(config.direct_link, "_blank", "noopener,noreferrer");
      // Auto-dismiss setelah diklik (biar tidak ganggu lagi)
      handleDismiss();
    }
  };

  // === Jangan render apa-apa kalau tidak memenuhi syarat ===
  if (!config || config.isPremium || !config.direct_link || dismissed || !visible) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 40,
        background: "linear-gradient(to right, #1a1a1a, #0a0a0a)",
        borderTop: "1px solid rgba(255,255,255,0.1)",
        padding: "8px 12px",
        paddingBottom: "calc(8px + env(safe-area-inset-bottom))",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        boxShadow: "0 -4px 12px rgba(0,0,0,0.3)",
        animation: "adsterraSlideUp 0.3s ease-out",
      }}
    >
      {/* Sponsored label */}
      <span
        style={{
          background: "rgba(255,255,255,0.1)",
          color: "#999",
          fontSize: "9px",
          fontWeight: 700,
          padding: "2px 5px",
          borderRadius: "3px",
          textTransform: "uppercase",
          letterSpacing: "0.5px",
          flexShrink: 0,
        }}
      >
        Ad
      </span>

      {/* Ad text */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          color: "#e5e5e5",
          fontSize: "12px",
          fontWeight: 500,
        }}
      >
        <p style={{ margin: 0, lineHeight: 1.3 }}>
          Tonton lebih banyak film tanpa batas
        </p>
        <p
          style={{
            margin: 0,
            fontSize: "10px",
            color: "#777",
            lineHeight: 1.3,
          }}
        >
          Sponsored Content
        </p>
      </div>

      {/* CTA Button */}
      <button
        onClick={handleClick}
        style={{
          background: "#B20710",
          color: "white",
          border: "none",
          padding: "6px 12px",
          borderRadius: "6px",
          fontSize: "11px",
          fontWeight: 600,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "4px",
          flexShrink: 0,
        }}
      >
        Lihat
        <ExternalLink style={{ width: "10px", height: "10px" }} />
      </button>

      {/* Close button */}
      <button
        onClick={handleDismiss}
        aria-label="Close ad"
        style={{
          background: "transparent",
          border: "none",
          color: "#666",
          cursor: "pointer",
          padding: "4px",
          flexShrink: 0,
        }}
      >
        <X style={{ width: "14px", height: "14px" }} />
      </button>

      {/* Animation keyframes */}
      <style>{`
        @keyframes adsterraSlideUp {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
