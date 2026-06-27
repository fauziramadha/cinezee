/**
 * src/i18n/use-translation.ts
 *
 * Hook useTranslation() untuk akses translasi.
 * - Membaca bahasa aktif dari session (NextAuth)
 * - Fallback ke localStorage atau 'en' kalau belum login
 * - Return function t(key) untuk translate
 *
 * Cara pakai:
 *   import { useTranslation } from "@/i18n/use-translation";
 *
 *   function MyComponent() {
 *     const { t, lang } = useTranslation();
 *     return <button>{t('play_now')}</button>;
 *   }
 */

"use client";

import { useSession } from "next-auth/react";
import { getTranslation, type Language, type TranslationKeys } from "./messages";

interface UseTranslationReturn {
  lang: Language;
  t: (key: TranslationKeys) => string;
  tArray: (key: TranslationKeys) => string[];
}

// ============================================================
// MAIN HOOK
// ============================================================
export function useTranslation(): UseTranslationReturn {
  const { data: session } = useSession();

  // Determine language: session → localStorage → 'en'
  let lang: Language = "en";

  // Priority 1: Session language (if logged in)
  const sessionLang = (session?.user as any)?.language as Language | undefined;
  if (sessionLang) {
    lang = sessionLang;
  } else if (typeof window !== "undefined") {
    // Priority 2: localStorage (for non-logged-in users)
    const stored = localStorage.getItem("cinestream_language") as Language | null;
    if (stored && ["en", "id", "es", "fr", "de", "pt", "ja", "ko", "zh"].includes(stored)) {
      lang = stored;
    }
  }

  // Translation function
  const t = (key: TranslationKeys): string => {
    return getTranslation(lang, key);
  };

  // For future: return array (e.g., for nav items)
  const tArray = (key: TranslationKeys): string[] => {
    const val = getTranslation(lang, key);
    try {
      return JSON.parse(val);
    } catch {
      return [val];
    }
  };

  return { lang, t, tArray };
}

// ============================================================
// HELPER: Set language (untuk guest/non-logged-in users)
// ============================================================
export function setGuestLanguage(lang: Language): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("cinestream_language", lang);
  }
}

// ============================================================
// HELPER: Get language without hook (untuk server components)
// ============================================================
export function getLanguage(lang?: string): Language {
  if (!lang) return "en";
  const validLangs: Language[] = ["en", "id", "es", "fr", "de", "pt", "ja", "ko", "zh"];
  return validLangs.includes(lang as Language) ? (lang as Language) : "en";
}
