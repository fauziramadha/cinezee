"use client";

import { useState, useEffect } from "react";
import { getTranslation, type Language, type TranslationKeys } from "./messages";

const VALID_LANGS: Language[] = ["en", "id", "es", "fr", "de", "pt", "ja", "ko", "zh"];

interface UseTranslationReturn {
  lang: Language;
  t: (key: TranslationKeys) => string;
  tArray: (key: TranslationKeys) => string[];
}

export function useTranslation(): UseTranslationReturn {
  // Default ke "en" saat build (SSG) maupun first load
  const [lang, setLang] = useState<Language>("en");

  useEffect(() => {
    // Ini hanya jalan di browser (client), tidak pernah di-eval saat build
    try {
      const stored = localStorage.getItem("cinestream_language") as Language | null;
      if (stored && VALID_LANGS.includes(stored)) {
        setLang(stored);
      }
    } catch {}

    // Listen jika bahasa diubah oleh setGuestLanguage
    const handler = () => {
      try {
        const stored = localStorage.getItem("cinestream_language") as Language | null;
        if (stored && VALID_LANGS.includes(stored)) {
          setLang(stored);
        }
      } catch {}
    };

    window.addEventListener("cinestream-language-change", handler);
    window.addEventListener("storage", handler);

    return () => {
      window.removeEventListener("cinestream-language-change", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

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

export function setGuestLanguage(lang: Language): void {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem("cinestream_language", lang);
    } catch {}
    window.dispatchEvent(
      new CustomEvent("cinestream-language-change", { detail: lang })
    );
  }
}

export function getLanguage(lang?: string): Language {
  if (!lang) return "en";
  return VALID_LANGS.includes(lang as Language) ? (lang as Language) : "en";
}
