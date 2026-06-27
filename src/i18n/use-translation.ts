/**
 * src/i18n/use-translation.ts
 *
 * Hook useTranslation() untuk akses translasi.
 * - Membaca bahasa aktif dari localStorage (priority 1)
 * - Fallback ke session atau 'en' kalau localStorage kosong
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

const VALID_LANGS: Language[] = ["en", "id", "es", "fr", "de", "pt", "ja", "ko", "zh"];

interface UseTranslationReturn {
  lang: Language;
  t: (key: TranslationKeys) => string;
  tArray: (key: TranslationKeys) => string[];
}

// ============================================================
// MAIN HOOK
// ============================================================
export function useTranslation(): UseTranslationReturn {
  // Safe useSession — handle undefined during SSG prerender
  const sessionResult = useSession() as any;
  const session = sessionResult?.data ?? null;

  // Determine language: localStorage (1) → session (2) → 'en' default
  let lang: Language = "en";

  // Priority 1: localStorage (langsung update saat ganti bahasa, survive reload)
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("cinestream_language") as Language | null;
    if (stored && VALID_LANGS.includes(stored)) {
      lang = stored;
    }
  }

  // Priority 2: Session language (fallback kalau localStorage kosong)
  if (lang === "en") {
    const sessionLang = (session?.user as any)?.language as Language | undefined;
    if (sessionLang && VALID_LANGS.includes(sessionLang)) {
      lang = sessionLang;
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
    // Trigger event agar TranslationProvider tau & update state
    window.dispatchEvent(
      new CustomEvent("cinestream-language-change", { detail: lang })
    );
  }
}

// ============================================================
// HELPER: Get language without hook (untuk server components)
// ============================================================
export function getLanguage(lang?: string): Language {
  if (!lang) return "en";
  return VALID_LANGS.includes(lang as Language) ? (lang as Language) : "en";
}
