/**
 * CineStream Service Worker v4 (NO-OP)
 * 
 * Version ini TIDAK melakukan caching apapun.
 * Semua request langsung pass-through ke network.
 * 
 * Ini untuk mengeliminasi semua bug yang disebabkan oleh SW cache:
 * - Stuck loading saat reopen
 * - "Load failed" di page selain homepage
 * - JS lama ter-cache
 * 
 * Setelah SW v4 aktif, dia akan:
 * 1. Delete semua cache lama (v2, v3)
 * 2. Tidak intercept request apapun
 * 3. Browser selalu fetch fresh dari network
 */

const CACHE_VERSION = "cinestream-v4";

// ============================================================
// INSTALL — delete all old caches, skip waiting
// ============================================================
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          console.log("[SW v4] Deleting old cache:", name);
          return caches.delete(name);
        })
      );
    }).then(() => {
      console.log("[SW v4] All old caches deleted");
      return self.skipWaiting();
    })
  );
});

// ============================================================
// ACTIVATE — claim all clients immediately
// ============================================================
self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      // Delete any remaining old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_VERSION)
            .map((name) => caches.delete(name))
        );
      }),
      // Take control of all clients immediately
      self.clients.claim(),
    ]).then(() => {
      console.log("[SW v4] Activated - no caching, all requests pass-through");
    })
  );
});

// ============================================================
// FETCH — DO NOT INTERCEPT ANYTHING
// All requests go directly to network.
// No caching, no offline fallback.
// ============================================================
// Intentionally empty - no fetch event listener
// This means the browser handles all requests normally
