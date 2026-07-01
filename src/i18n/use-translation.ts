"use client";

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
  let lang: Language = "en";

  // Hanya baca dari localStorage (Client-side only)
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem("cinestream_language") as Language | null;
      if (stored && VALID_LANGS.includes(stored)) {
        lang = stored;
      }
    } catch {}
  }

  const t = (key: TranslationKeys): string => getTranslation(lang, key);
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
    try {
      localStorage.setItem("cinestream_language", lang);
    } catch {}
    // Trigger event agar komponen lain tau & re-render
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
