"use client";

import { create } from "zustand";

export type MediaType = "movie" | "tv";

export interface SelectedMedia {
  id: number;
  type: MediaType;
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
  // Cinemacity fields (optional — untuk backward compatibility dengan TMDB)
  slug?: string;                              // cinemacity slug, e.g. "1873-obsession"
  source?: "tmdb" | "cinemacity";            // sumber data
}

export interface WatchHistoryItem extends SelectedMedia {
  watchedAt: string;
  progress?: number;
  season?: number;
  episode?: number;
}

interface AppState {
  // Auth modal
  authModalOpen: boolean;
  setAuthModalOpen: (open: boolean) => void;

  // Admin Dashboard
  adminDashboardOpen: boolean;
  setAdminDashboardOpen: (open: boolean) => void;

  // Search
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;

  // Detail modal
  selectedMedia: SelectedMedia | null;
  setSelectedMedia: (media: SelectedMedia | null) => void;

  // Player modal
  playerMedia: SelectedMedia | null;
  playerSeason?: number;
  playerEpisode?: number;
  openPlayer: (media: SelectedMedia, season?: number, episode?: number) => void;
  closePlayer: () => void;

  // Watch history (persisted to localStorage)
  history: WatchHistoryItem[];
  addToHistory: (item: WatchHistoryItem) => void;
  removeFromHistory: (id: number) => void;
  clearHistory: () => void;
  loadHistory: () => void;

  // === TAMBAHAN: Anime & Donghua Server Selection ===
  // Global state for SearchModal to know which server is active
  animeServer: "otakudesu" | "animasu";
  setAnimeServer: (server: "otakudesu" | "animasu") => void;
  donghuaServer: "s1" | "s2";
  setDonghuaServer: (server: "s1" | "s2") => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Auth modal
  authModalOpen: false,
  setAuthModalOpen: (open) => set({ authModalOpen: open }),

  // Admin Dashboard
  adminDashboardOpen: false,
  setAdminDashboardOpen: (open) => set({ adminDashboardOpen: open }),

  // Search
  searchOpen: false,
  setSearchOpen: (open) => set({ searchOpen: open }),

  // Detail modal
  selectedMedia: null,
  setSelectedMedia: (media) => set({ selectedMedia: media }),

  // Player modal
  playerMedia: null,
  openPlayer: (media, season, episode) =>
    set({
      playerMedia: media,
      playerSeason: season,
      playerEpisode: episode,
    }),
  closePlayer: () =>
    set({ playerMedia: null, playerSeason: undefined, playerEpisode: undefined }),

  // Watch history
  history: [],
  addToHistory: (item) => {
    const existing = get().history.filter((h) => h.id !== item.id);
    const history = [item, ...existing].slice(0, 20);
    set({ history });
    if (typeof window !== "undefined") {
      localStorage.setItem("cinestream_history", JSON.stringify(history));
    }
  },
  removeFromHistory: (id) => {
    const history = get().history.filter((h) => h.id !== id);
    set({ history });
    if (typeof window !== "undefined") {
      localStorage.setItem("cinestream_history", JSON.stringify(history));
    }
  },
  clearHistory: () => {
    set({ history: [] });
    if (typeof window !== "undefined") {
      localStorage.removeItem("cinestream_history");
    }
  },
  loadHistory: () => {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem("cinestream_history");
      if (stored) {
        set({ history: JSON.parse(stored) });
      }
    } catch {
      // ignore parse errors
    }
  },

  // === IMPLEMENTASI: Anime & Donghua Server Selection ===
  animeServer: "otakudesu", // Default Server 1
  setAnimeServer: (server) => set({ animeServer: server }),
  donghuaServer: "s1", // Default Server 1
  setDonghuaServer: (server) => set({ donghuaServer: server }),
}));
