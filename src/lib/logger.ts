/**
 * src/lib/logger.ts
 *
 * Logger utility untuk CineStream.
 * - Log ke console (development)
 * - Log ke D1 database (production)
 * - Support levels: debug, info, warn, error
 * - Support categories: api, auth, db, cache, pwa, etc.
 *
 * Cara pakai:
 *   import { logger } from "@/lib/logger";
 *
 *   await logger.info("api", "User fetched watchlist", { userId, count: 5 });
 *   await logger.error("db", "Failed to query user", { error: err.message });
 *   await logger.warn("cache", "Cache miss for key", { key });
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";

export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogCategory =
  | "api"
  | "auth"
  | "db"
  | "cache"
  | "pwa"
  | "provider"
  | "message"
  | "user"
  | "system"
  | "security";

interface LogContext {
  [key: string]: any;
}

interface LogEntry {
  level: LogLevel;
  category: LogCategory;
  message: string;
  context?: LogContext;
  userId?: string;
  userAgent?: string;
  ipAddress?: string;
  path?: string;
  method?: string;
  statusCode?: number;
  durationMs?: number;
}

// ============================================================
// D1 ACCESS
// ============================================================
async function getD1(): Promise<D1Database | null> {
  try {
    const ctx = await getCloudflareContext();
    return (ctx?.env?.DB as D1Database) || null;
  } catch {
    return null;
  }
}

// ============================================================
// LOGGER
// ============================================================
class Logger {
  private async write(entry: LogEntry): Promise<void> {
    // 1. Always log to console (for development & Cloudflare dashboard logs)
    const consoleMsg = `[${entry.level.toUpperCase()}] [${entry.category}] ${entry.message}`;
    const consoleContext = entry.context ? ` ${JSON.stringify(entry.context)}` : "";

    switch (entry.level) {
      case "error":
        console.error(consoleMsg + consoleContext);
        break;
      case "warn":
        console.warn(consoleMsg + consoleContext);
        break;
      case "info":
        console.info(consoleMsg + consoleContext);
        break;
      case "debug":
        console.debug(consoleMsg + consoleContext);
        break;
    }

    // 2. Log to D1 (skip debug level to save quota)
    if (entry.level === "debug") return;

    try {
      const d1 = await getD1();
      if (!d1) return;

      await d1
        .prepare(
          `INSERT INTO system_log
            (level, category, message, context, user_id, user_agent, ip_address, path, method, status_code, duration_ms)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          entry.level,
          entry.category,
          entry.message,
          entry.context ? JSON.stringify(entry.context) : null,
          entry.userId || null,
          entry.userAgent || null,
          entry.ipAddress || null,
          entry.path || null,
          entry.method || null,
          entry.statusCode || null,
          entry.durationMs || null
        )
        .run();
    } catch (err) {
      // Silent fail — don't crash app because logging failed
      console.error("[LOGGER] Failed to write to D1:", err);
    }
  }

  // === Level methods ===
  async debug(category: LogCategory, message: string, context?: LogContext): Promise<void> {
    await this.write({ level: "debug", category, message, context });
  }

  async info(category: LogCategory, message: string, context?: LogContext): Promise<void> {
    await this.write({ level: "info", category, message, context });
  }

  async warn(category: LogCategory, message: string, context?: LogContext): Promise<void> {
    await this.write({ level: "warn", category, message, context });
  }

  async error(
    category: LogCategory,
    message: string,
    context?: LogContext,
    error?: Error
  ): Promise<void> {
    const enrichedContext = error
      ? {
          ...context,
          errorName: error.name,
          errorMessage: error.message,
          errorStack: error.stack,
        }
      : context;

    await this.write({ level: "error", category, message, context: enrichedContext });
  }

  // === API logging helper (with request context) ===
  async logApi(
    level: LogLevel,
    category: LogCategory,
    message: string,
    request: Request,
    context?: LogContext,
    durationMs?: number,
    statusCode?: number
  ): Promise<void> {
    const url = new URL(request.url);
    const userAgent = request.headers.get("user-agent") || undefined;
    const ipAddress =
      request.headers.get("cf-connecting-ip") ||
      request.headers.get("x-forwarded-for") ||
      undefined;

    await this.write({
      level,
      category,
      message,
      context,
      userAgent,
      ipAddress,
      path: url.pathname + url.search,
      method: request.method,
      durationMs,
      statusCode,
    });
  }
}

// === Export singleton ===
export const logger = new Logger();

// ============================================================
// PERFORMANCE TRACKER
// ============================================================
/**
 * Helper untuk track API response time.
 *
 * Cara pakai:
 *   const tracker = trackPerformance("api", "GET /api/genres");
 *   // ... do work ...
 *   tracker.end();  // auto-log duration
 */
export function trackPerformance(category: LogCategory, label: string) {
  const startTime = Date.now();

  return {
    end: async (level: LogLevel = "info", context?: LogContext) => {
      const durationMs = Date.now() - startTime;
      await logger.write({
        level,
        category,
        message: label,
        context: { ...context, durationMs },
        durationMs,
      });
      return durationMs;
    },
  };
}
