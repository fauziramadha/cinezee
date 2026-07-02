"use client";

import { useEffect, useState } from "react";

interface MonetagConfig {
  popunder_url: string | null;
  isPremium: boolean;
}

const COOLDOWN_MS = 5 * 60 * 1000; // 5 menit antara popunder
const MAX_PER_SESSION = 3; // Maksimal 3 popunder per session
const STORAGE_KEY = "cinestream_popunder_state";

interface PopunderState {
  lastShown: number; // timestamp
  count: number; // jumlah popunder yang sudah muncul session ini
}

function loadState(): PopunderState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { lastShown: 0, count: 0 };
}

function saveState(state: PopunderState) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

/**
 * Monetag Popunder Loader (ANTI-SPAM VERSION)
 *
 * Fitur:
 * - Cooldown 5 menit antara popunder
 * - Maksimal 3 popunder per session
 * - Skip saat user di player modal (sedang nonton)
 * - Skip saat user di form input (sedang ngetik)
 * - Skip untuk premium user
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
    if (!config || config.isPremium || !config.popunder_url) return;

    // Inject script Monetag
    const script = document.createElement("script");
    script.src = config.popunder_url;
    script.async = true;
    script.defer = true;
    script.setAttribute("data-cfasync", "false");
    script.setAttribute("type", "text/javascript");
    document.body.appendChild(script);

    // ============================================================
    // ANTI-SPAM: Intercept click event sebelum Monetag handle
    // ============================================================
    const clickInterceptor = (e: MouseEvent) => {
      // 1. Cek cooldown & session limit
      const state = loadState();
      const now = Date.now();
      const sinceLast = now - state.lastShown;

      if (state.count >= MAX_PER_SESSION) {
        // Sudah capai limit session → block popunder
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }

      if (sinceLast < COOLDOWN_MS) {
        // Masih dalam cooldown → block popunder
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }

      // 2. Skip kalau user klik di dalam player modal (sedang nonton)
      const target = e.target as HTMLElement;
      const playerModal = target.closest("[data-player-modal]");
      if (playerModal) {
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }

      // 3. Skip kalau user sedang di form input (login/register/comment)
      const tagName = target.tagName.toLowerCase();
      if (
        tagName === "input" ||
        tagName === "textarea" ||
        tagName === "select" ||
        target.isContentEditable
      ) {
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }

      // 4. Skip kalau user klik link internal (navigasi antar halaman)
      const link = target.closest("a");
      if (link && link.href && link.href.startsWith(window.location.origin)) {
        // Link internal → kasih popunder tapi biarkan navigasi jalan
        // (tidak stopPropagation, Monetag bisa jalan)
      }

      // Jika semua cek lolos → update state (popunder akan muncul)
      saveState({
        lastShown: now,
        count: state.count + 1,
      });
    };

    // Pakai capture: true supaya interceptor jalan SEBELUM Monetag handler
    document.addEventListener("click", clickInterceptor, true);

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
      document.removeEventListener("click", clickInterceptor, true);
    };
  }, [config]);

  return null;
}
