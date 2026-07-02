"use client";

import { useEffect, useState } from "react";

interface MonetagConfig {
  popunder_url: string | null;
  isPremium: boolean;
}

/**
 * Monetag Popunder Loader
 *
 * - Fetch config dari /api/ads/config
 * - Kalau ada popunder_url dan user BUKAN premium → inject script
 * - Script Monetag handle click event global → buka tab popunder
 * - Komponen ini return null (tidak render apa-apa secara visual)
 */
export function MonetagPopunder() {
  const [config, setConfig] = useState<MonetagConfig | null>(null);

  useEffect(() => {
    fetch("/api/ads/config")
      .then((res) => res.json())
      .then((data) => {
        setConfig({
          popunder_url: data.monetag?.popunder_url || null,
          isPremium: !!data.isPremium,
        });
      })
      .catch(() => setConfig(null));
  }, []);

  useEffect(() => {
    // Jangan load kalau:
    // - Config belum loaded
    // - User premium
    // - Tidak ada URL popunder
    if (!config || config.isPremium || !config.popunder_url) return;

    // Inject script Monetag
    const script = document.createElement("script");
    script.src = config.popunder_url;
    script.async = true;
    script.defer = true;

    // Attribute tambahan yang biasanya diminta Monetag
    script.setAttribute("data-cfasync", "false");
    script.setAttribute("type", "text/javascript");

    document.body.appendChild(script);

    // Cleanup saat unmount (misal user jadi premium)
    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [config]);

  // Komponen ini tidak render apa-apa secara visual
  return null;
}
