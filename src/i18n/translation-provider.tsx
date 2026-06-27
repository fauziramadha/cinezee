/**
 * src/i18n/translation-provider.tsx
 *
 * Context Provider untuk translasi.
 * - Wrap sekali di root layout
 * - Share instance bahasa aktif ke semua komponen
 * - Lebih efficient daripada setiap komponen call useSession()
 *
 * Cara pakai di layout.tsx:
 *   import { TranslationProvider } from "@/i18n/translation-provider";
 *
 *   <TranslationProvider>
 *     {children}
 *   </TranslationProvider>
 *
 * Lalu di komponen apapun:
 *   import { useTranslation } from "@/i18n/use-translation";
 *   const { t, lang } = useTranslation();
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

const TranslationContext = createContext<TranslationContextType>({
  lang: "en",
  t: (key) => String(key),
  setLang: () => {},
  isLoading: true,
});

// ============================================================
// PROVIDER
// ============================================================
export function TranslationProvider({ children }: { children: React.ReactNode }) {
  // Safe useSession — handle undefined during SSG prerender
  const sessionResult = useSession() as any;
  const session = sessionResult?.data ?? null;
  const status = sessionResult?.status ?? "unauthenticated";
  const [lang, setLangState] = useState<Language>("en");
  const [isLoading, setIsLoading] = useState(true);

  // ============================================================
  // SYNC LANGUAGE
  // Priority: localStorage (1) → Session (2) → 'en' default
  // ============================================================
  useEffect(() => {
    if (status === "loading") return;

    // Priority 1: localStorage (langsung update saat ganti bahasa, survive reload)
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("cinestream_language") as Language | null;
      if (stored && VALID_LANGS.includes(stored)) {
        setLangState(stored);
        setIsLoading(false);
        return;
      }
    }

    // Priority 2: Session language (untuk login di device baru)
    const sessionLang = (session?.user as any)?.language as Language | undefined;
    if (sessionLang && VALID_LANGS.includes(sessionLang)) {
      setLangState(sessionLang);
      // Sync localStorage dengan session (untuk consistency)
      if (typeof window !== "undefined") {
        localStorage.setItem("cinestream_language", sessionLang);
      }
    }
    setIsLoading(false);
  }, [session, status]);

  // ============================================================
  // LISTEN FOR LANGUAGE CHANGE EVENTS
  // (dari user-menu.tsx saat user ganti bahasa)
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
      localStorage.setItem("cinestream_language", newLang);
      // Trigger event agar komponen lain tau
      window.dispatchEvent(
        new CustomEvent("cinestream-language-change", { detail: newLang })
      );
    }
  };

  // Memoize translation function untuk performance
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
    <TranslationContext.Provider value={value}>
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
