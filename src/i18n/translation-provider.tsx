/**
 * src/i18n/translation-provider.tsx (FINAL - Fix hydration & sync)
 *
 * - Lazy init dari localStorage (cegah flash "en" → "id")
 * - Hapus dependency status (langsung baca localStorage saat mount)
 * - suppressHydrationWarning untuk avoid mismatch warning
 */

"use client";

import React, { createContext, useContext, useMemo, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  getTranslation,
  type Language,
  type TranslationKeys,
} from "./messages";

const VALID_LANGS: Language[] = ["en", "id", "es", "fr", "de", "pt", "ja", "ko", "zh"];

// ============================================================
// CONTEXT TYPE
// ============================================================
interface TranslationContextType {
  lang: Language;
  t: (key: TranslationKeys) => string;
  setLang: (lang: Language) => void;
  isLoading: boolean;
}

// Default null agar bisa detect apakah di dalam Provider atau tidak
const TranslationContext = createContext<TranslationContextType | null>(null);

// ============================================================
// HELPER: Baca localStorage dengan aman
// ============================================================
function getStoredLang(): Language | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem("cinestream_language") as Language | null;
    if (stored && VALID_LANGS.includes(stored)) {
      return stored;
    }
  } catch {}
  return null;
}

// ============================================================
// PROVIDER
// ============================================================
export function TranslationProvider({ children }: { children: React.ReactNode }) {
  // Safe useSession
  const sessionResult = useSession() as any;
  const session = sessionResult?.data ?? null;

  // Lazy init: baca localStorage saat pertama init (client only)
  const [lang, setLangState] = useState<Language>(() => {
    return getStoredLang() || "en";
  });
  const [isLoading, setIsLoading] = useState(false); // Tidak loading lagi karena lazy init

  // ============================================================
  // SYNC: Update dari session kalau localStorage kosong
  // ============================================================
  useEffect(() => {
    const stored = getStoredLang();

    // Kalau localStorage ada, pakai itu (priority 1)
    if (stored) {
      setLangState(stored);
      return;
    }

    // Kalau localStorage kosong, coba pakai session (priority 2)
    const sessionLang = (session?.user as any)?.language as Language | undefined;
    if (sessionLang && VALID_LANGS.includes(sessionLang)) {
      setLangState(sessionLang);
      // Sync localStorage dengan session
      try {
        localStorage.setItem("cinestream_language", sessionLang);
      } catch {}
    }
  }, [session]);

  // ============================================================
  // LISTEN FOR LANGUAGE CHANGE EVENTS
  // ============================================================
  useEffect(() => {
    const handleLanguageChange = (e: Event) => {
      const customEvent = e as CustomEvent<Language>;
      if (customEvent.detail && VALID_LANGS.includes(customEvent.detail)) {
        setLangState(customEvent.detail);
      }
    };

    window.addEventListener("cinestream-language-change", handleLanguageChange);
    return () => {
      window.removeEventListener("cinestream-language-change", handleLanguageChange);
    };
  }, []);

  // ============================================================
  // SET LANGUAGE FUNCTION
  // ============================================================
  const setLang = (newLang: Language) => {
    setLangState(newLang);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("cinestream_language", newLang);
      } catch {}
      window.dispatchEvent(
        new CustomEvent("cinestream-language-change", { detail: newLang })
      );
    }
  };

  // Memoize value
  const value = useMemo<TranslationContextType>(
    () => ({
      lang,
      t: (key: TranslationKeys) => getTranslation(lang, key),
      setLang,
      isLoading,
    }),
    [lang, isLoading]
  );

  return (
    <TranslationContext.Provider value={value} suppressHydrationWarning>
      {children}
    </TranslationContext.Provider>
  );
}

// ============================================================
// HOOK (export ulang untuk convenience)
// ============================================================
export function useTranslationContext() {
  return useContext(TranslationContext);
}
