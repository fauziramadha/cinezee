/**
 * src/i18n/use-translation.ts (FINAL - Pakai Context)
 *
 * Hook useTranslation() sekarang pakai Context dari TranslationProvider.
 * - Jika di dalam Provider → pakai context (re-render otomatis saat bahasa berubah)
 * - Jika di luar Provider → fallback ke localStorage + session.
 */

"use client";

import { useSession } from "next-auth/react";
import { useContext } from "react";
import { getTranslation, type Language, type TranslationKeys } from "./messages";
import { TranslationContext } from "./translation-provider";

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
  // 1. Hooks WAJIB dipanggil di paling atas, TIDAK BOLEH di dalam if/else
  // Ini untuk mencegah error "Invalid hook call" saat SSG/prerender
  const context = useContext(TranslationContext);
  const sessionResult = useSession() as any;
  const session = sessionResult?.data ?? null;

  // 2. Jika context tersedia (di dalam Provider), pakai context
  if (context) {
    const t = (key: TranslationKeys): string => getTranslation(context.lang, key);
    const tArray = (key: TranslationKeys): string[] => {
      const val = getTranslation(context.lang, key);
      try {
        return JSON.parse(val);
      } catch {
        return [val];
      }
    };
    return { lang: context.lang, t, tArray };
  }

  // ============================================================
  // 3. FALLBACK: Untuk komponen di luar Provider
  // ============================================================
  let lang: Language = "en";

  // Priority 1: localStorage
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem("cinestream_language") as Language | null;
      if (stored && VALID_LANGS.includes(stored)) {
        lang = stored;
      }
    } catch {}
  }

  // Priority 2: Session
  if (lang === "en") {
    const sessionLang = (session?.user as any)?.language as Language | undefined;
    if (sessionLang && VALID_LANGS.includes(sessionLang)) {
      lang = sessionLang;
    }
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
