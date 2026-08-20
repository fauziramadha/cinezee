"use client";

import { create } from "zustand";

export type MediaType = "movie" | "tv";

export interface PlayerSeason {
  seasonNumber: number;
  episodeCount: number;
  name?: string;
}

export interface SelectedMedia {
  id: number | string;
  type: MediaType;
  title: string;
  
  // === VPS API Fields (CineStream v2) ===
  cinemacityId?: string;
  slug?: string;
  poster?: string;
  backdrop?: string;
  overview?: string;
  year?: string;
  rating?: number;
  quality?: string;
  
  // Pre-fill current episode (untuk TV)
  _currentSeason?: string;
  _currentEpisode?: string;
}

export interface WatchHistoryItem extends SelectedMedia {
  watchedAt: string;
  progress?: number;
  duration?: number;
  season?: number;
  episode?: number;
}

export interface FavoriteItem extends SelectedMedia {
  addedAt: string;
}

export interface ActivityItem {
  id: string;
  type: "watch" | "favorite" | "rating" | "comment";
  mediaTitle: string;
  mediaId: number | string;
  mediaType: string;
  detail?: string;
  timestamp: string;
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
  setDetailMedia: (media: SelectedMedia | null) => void;

  // Player modal
  playerMedia: SelectedMedia | null;
  playerSeason?: number;
  playerEpisode?: number;
  openPlayer: (media: SelectedMedia, season?: number, episode?: number) => void;
  setPlayerMedia: (media: SelectedMedia | null) => void;
  closePlayer: () => void;

  // Watch history
  history: WatchHistoryItem[];
  addToHistory: (item: WatchHistoryItem) => void;
  removeFromHistory: (id: number | string) => void;
  clearHistory: () => void;
  loadHistory: () => void;
  updateHistoryProgress: (id: number | string, progress: number, duration: number) => void;

  // Favorites
  favorites: FavoriteItem[];
  toggleFavorite: (item: SelectedMedia) => void;
  loadFavorites: () => void;

  // Activity log
  activityLog: ActivityItem[];
  addActivity: (item: ActivityItem) => void;
  loadActivity: () => void;

  // Anime & Donghua Server Selection
  animeServer: "otakudesu" | "animasu";
  setAnimeServer: (server: "otakudesu" | "animasu") => void;
  donghuaServer: "s1" | "s2";
  setDonghuaServer: (server: "s1" | "s2") => void;
}

const MAX_FAVORITES = 50;
const MAX_ACTIVITY = 50;

function saveToStorage(key: string, data: any) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {}
}

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = localStorage.getItem(key);
    if (stored) return JSON.parse(stored);
  } catch {}
  return fallback;
}

export const useAppStore = create<AppState>((set, get) => ({
  authModalOpen: false,
  setAuthModalOpen: (open) => set({ authModalOpen: open }),

  adminDashboardOpen: false,
  setAdminDashboardOpen: (open) => set({ adminDashboardOpen: open }),

  searchOpen: false,
  setSearchOpen: (open) => set({ searchOpen: open }),

  // === Detail modal ===
  selectedMedia: null,
  setSelectedMedia: (media) => set({ selectedMedia: media }),
  setDetailMedia: (media) => set({ selectedMedia: media }),

  // === Player modal ===
  playerMedia: null,
  openPlayer: (media, season, episode) =>
    set({ playerMedia: media, playerSeason: season, playerEpisode: episode }),
  setPlayerMedia: (media) => set({ playerMedia: media }),
  closePlayer: () =>
    set({ playerMedia: null, playerSeason: undefined, playerEpisode: undefined }),

  // === Watch history ===
  history: [],
  addToHistory: (item) => {
    const existing = get().history.filter((h) => h.id !== item.id);
    const history = [item, ...existing].slice(0, 20);
    set({ history });
    saveToStorage("cinestream_history", history);

    get().addActivity({
      id: `watch-${item.id}-${Date.now()}`,
      type: "watch",
      mediaTitle: item.title,
      mediaId: item.id,
      mediaType: item.type,
      timestamp: new Date().toISOString(),
    });
  },
  removeFromHistory: (id) => {
    const history = get().history.filter((h) => h.id !== id);
    set({ history });
    saveToStorage("cinestream_history", history);
  },
  clearHistory: () => {
    set({ history: [] });
    if (typeof window !== "undefined") {
      localStorage.removeItem("cinestream_history");
    }
  },
  loadHistory: () => {
    set({ history: loadFromStorage("cinestream_history", []) });
  },
  updateHistoryProgress: (id, progress, duration) => {
    const history = get().history.map((h) =>
      h.id === id ? { ...h, progress, duration, watchedAt: new Date().toISOString() } : h
    );
    set({ history });
    saveToStorage("cinestream_history", history);
  },

  // === Favorites ===
  favorites: [],
  toggleFavorite: (item) => {
    const existing = get().favorites.find(f => f.id === item.id);
    let favorites: FavoriteItem[];
    if (existing) {
      favorites = get().favorites.filter(f => f.id !== item.id);
    } else {
      favorites = [{ ...item, addedAt: new Date().toISOString() }, ...get().favorites].slice(0, MAX_FAVORITES);
      get().addActivity({
        id: `fav-${item.id}-${Date.now()}`,
        type: "favorite",
        mediaTitle: item.title,
        mediaId: item.id,
        mediaType: item.type,
        timestamp: new Date().toISOString(),
      });
    }
    set({ favorites });
    saveToStorage("cinestream_favorites", favorites);
  },
  loadFavorites: () => {
    set({ favorites: loadFromStorage("cinestream_favorites", []) });
  },

  // === Activity log ===
  activityLog: [],
  addActivity: (item) => {
    const log = [item, ...get().activityLog].slice(0, MAX_ACTIVITY);
    set({ activityLog: log });
    saveToStorage("cinestream_activity", log);
  },
  loadActivity: () => {
    set({ activityLog: loadFromStorage("cinestream_activity", []) });
  },

  // === Anime & Donghua Server ===
  animeServer: "otakudesu",
  setAnimeServer: (server) => set({ animeServer: server }),
  donghuaServer: "s1",
  setDonghuaServer: (server) => set({ donghuaServer: server }),
}));
