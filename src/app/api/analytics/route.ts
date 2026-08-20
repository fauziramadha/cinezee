import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Analytics API
 *
 * POST /api/analytics → Track an event
 *   Body: { eventType, mediaId?, mediaType?, metadata? }
 *
 * Note: Analytics can be tracked for both anonymous and logged-in users.
 */

function generateId(): string {
  return 'c' + Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
}

// Simple hash function for IP (privacy-friendly)
async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { eventType, mediaId, mediaType, metadata } = body;

    if (!eventType) {
      return NextResponse.json(
        { success: false, error: "Missing eventType" },
        { status: 400 },
      );
    }

    // Get session (optional, for logged-in users)
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id || null;

    // Hash IP for anonymous tracking (privacy)
    const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown";
    const ipHash = await hashString(ip);
    const userAgent = request.headers.get("user-agent") || null;

    const ctx = await getCloudflareContext();
    const d1 = ctx.env.DB as D1Database;

    const id = generateId();
    const now = new Date().toISOString();

    await d1
      .prepare(
        "INSERT INTO AnalyticsEvent (id, userId, eventType, mediaId, mediaType, metadata, ipHash, userAgent, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        id,
        userId,
        eventType,
        mediaId || null,
        mediaType || null,
        metadata ? JSON.stringify(metadata) : null,
        ipHash,
        userAgent,
        now,
      )
      .run();

    return NextResponse.json(
      { success: true, message: "Event tracked" },
      { status: 201 },
    );
  } catch (error: any) {
    console.error("[ANALYTICS POST ERROR]", error);
    // Silent fail for analytics - don't break user experience
    return NextResponse.json(
      { success: false, error: "Failed to track event" },
      { status: 500 },
    );
  }
}
