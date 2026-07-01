"use client";

import { useSyncExternalStore } from "react";
import { getTranslation, type Language, type TranslationKeys } from "./messages";

const VALID_LANGS: Language[] = ["en", "id", "es", "fr", "de", "pt", "ja", "ko", "zh"];

interface UseTranslationReturn {
  lang: Language;
  t: (key: TranslationKeys) => string;
  tArray: (key: TranslationKeys) => string[];
}

// Fungsi untuk subscribe ke perubahan bahasa
function subscribe(callback: () => void) {
  if (typeof window !== "undefined") {
    window.addEventListener("cinestream-language-change", callback);
    window.addEventListener("storage", callback);
    return () => {
      window.removeEventListener("cinestream-language-change", callback);
      window.removeEventListener("storage", callback);
    };
  }
  return () => {};
}

// Ambil bahasa saat ini di client
function getSnapshot() {
  if (typeof window !== "undefined") {
    return localStorage.getItem("cinestream_language") || "en";
  }
  return "en";
}

// Ambil bahasa saat build (SSG) - selalu return "en"
function getServerSnapshot() {
  return "en";
}

export function useTranslation(): UseTranslationReturn {
  // useSyncExternalStore aman untuk SSR/SSG
  const lang = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot) as Language;

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
