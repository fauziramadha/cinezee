/**
 * CineStream Service Worker
 *
 * Strategy:
 * 1. Precache app shell (homepage, manifest, icon) saat install
 * 2. Cache First untuk static assets (JS, CSS, images, fonts)
 * 3. Network First untuk API (selalu fresh, fallback cache saat offline)
 * 4. Stale While Revalidate untuk TMDB images (cepat + update background)
 * 5. Offline fallback page saat semua gagal
 */

const CACHE_VERSION = "cinestream-v1";
const OFFLINE_URL = "/offline.html";

// Resources yang di-cache saat install (app shell)
const PRECACHE_URLS = [
  "/",
  "/offline.html",
  "/manifest.json",
  "/icons/AC571102-A8DE-4EB8-9C21-37972F5E3346.png",
];

// ============================================================
// INSTALL — Precache app shell
// ============================================================
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => {
        console.log("[SW] Precaching app shell");
        return cache.addAll(PRECACHE_URLS);
      })
      .then(() => {
        // Activate immediately (jangan tunggu old SW release)
        return self.skipWaiting();
      })
      .catch((err) => {
        console.error("[SW] Precache failed:", err);
      })
  );
});

// ============================================================
// ACTIVATE — Cleanup old caches
// ============================================================
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_VERSION)
            .map((name) => {
              console.log("[SW] Deleting old cache:", name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        // Take control of all clients immediately
        return self.clients.claim();
      })
  );
});

// ============================================================
// FETCH — Strategy routing
// ============================================================
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests (POST, PUT, DELETE, dll)
  if (request.method !== "GET") {
    return;
  }

  // Skip chrome-extension requests
  if (url.protocol === "chrome-extension:") {
    return;
  }

  // === Strategy 1: Static Assets (Cache First) ===
  // JS, CSS, fonts, images dari domain sendiri
  if (
    url.origin === self.location.origin &&
    (url.pathname.startsWith("/_next/static/") ||
      url.pathname.startsWith("/icons/") ||
      url.pathname.match(/\.(js|css|woff2?|ttf|eot|png|jpg|jpeg|gif|svg|webp|ico)$/))
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // === Strategy 2: API Routes (Network First) ===
  // API butuh data fresh, fallback ke cache saat offline
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(request));
    return;
  }

  // === Strategy 3: TMDB Images (Stale While Revalidate) ===
  // image.tmdb.org — cache gambar, update di background
  if (url.hostname === "image.tmdb.org") {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // === Strategy 4: Navigation requests (Network First with offline fallback) ===
  // HTML pages — selalu coba network dulu, fallback ke cache/offline
  if (request.mode === "navigate") {
    event.respondWith(networkFirstWithOfflineFallback(request));
    return;
  }

  // === Default: try network, fallback to cache ===
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

// ============================================================
// CACHE STRATEGIES
// ============================================================

// Cache First — pakai cache kalau ada, kalau tidak fetch network
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_VERSION);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    // Return offline fallback kalau ada
    return caches.match(OFFLINE_URL);
  }
}

// Network First — coba network dulu, fallback ke cache
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    // Hanya cache response GET yang sukses
    if (response.ok && request.method === "GET") {
      const cache = await caches.open(CACHE_VERSION);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    // Network gagal (offline) — coba cache
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    // Kalau tidak ada cache, return offline response
    return new Response(
      JSON.stringify({ error: "Offline", message: "No internet connection" }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

// Stale While Revalidate — return cache langsung, update di background
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request);

  // Fetch di background (untuk update cache)
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached); // Kalau gagal, pakai cache

  // Return cache langsung kalau ada, kalau tidak tunggu network
  return cached || fetchPromise;
}

// Network First with Offline Fallback — untuk navigasi (HTML pages)
async function networkFirstWithOfflineFallback(request) {
  try {
    const response = await fetch(request);
    // Cache HTML pages
    if (response.ok) {
      const cache = await caches.open(CACHE_VERSION);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    // Offline — coba cache halaman yang diminta
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    // Fallback ke homepage cache
    const homepage = await caches.match("/");
    if (homepage) {
      return homepage;
    }
    // Kalau tidak ada, return offline page
    return caches.match(OFFLINE_URL);
  }
}

// ============================================================
// MESSAGE — untuk update SW dari client
// ============================================================
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
