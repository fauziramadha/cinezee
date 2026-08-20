/**
 * Analytics Helper
 *
 * Provides functions to track user events from the frontend.
 * Uses navigator.sendBeacon for reliability during page unloads,
 * and falls back to fetch with keepalive for other events.
 */

type EventType = "page_view" | "play" | "search" | "rating" | "comment" | "watchlist_add" | "watchlist_remove";

interface TrackEventParams {
  eventType: EventType;
  mediaId?: number;
  mediaType?: "movie" | "tv";
  metadata?: Record<string, any>;
}

/**
 * Track a user event
 * @param params Event details
 */
export function trackEvent({ eventType, mediaId, mediaType, metadata }: TrackEventParams) {
  try {
    const payload = JSON.stringify({
      eventType,
      mediaId,
      mediaType,
      metadata,
    });

    // 1. Try sendBeacon (best for page unload / navigation events)
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      const blob = new Blob([payload], { type: "application/json" });
      const success = navigator.sendBeacon("/api/analytics", blob);
      if (success) return;
    }

    // 2. Fallback to fetch with keepalive (works in modern browsers)
    if (typeof fetch !== "undefined") {
      fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true, // Ensures request completes even if page unloads
      }).catch(() => {
        // Silent fail - analytics should never break UX
      });
    }
  } catch (error) {
    // Silent fail
    console.debug("[Analytics Error]", error);
  }
}

// =====================================================
// Pre-defined helper functions for common events
// =====================================================

export function trackPageView(path: string) {
  trackEvent({
    eventType: "page_view",
    metadata: { path },
  });
}

export function trackPlay(mediaId: number, mediaType: "movie" | "tv", title?: string) {
  trackEvent({
    eventType: "play",
    mediaId,
    mediaType,
    metadata: title ? { title } : undefined,
  });
}

export function trackSearch(query: string) {
  trackEvent({
    eventType: "search",
    metadata: { query },
  });
}

export function trackRating(mediaId: number, mediaType: "movie" | "tv", rating: number) {
  trackEvent({
    eventType: "rating",
    mediaId,
    mediaType,
    metadata: { rating },
  });
}

export function trackComment(mediaId: number, mediaType: "movie" | "tv") {
  trackEvent({
    eventType: "comment",
    mediaId,
    mediaType,
  });
}

export function trackWatchlistAdd(mediaId: number, mediaType: "movie" | "tv") {
  trackEvent({
    eventType: "watchlist_add",
    mediaId,
    mediaType,
  });
}

export function trackWatchlistRemove(mediaId: number, mediaType: "movie" | "tv") {
  trackEvent({
    eventType: "watchlist_remove",
    mediaId,
    mediaType,
  });
}
