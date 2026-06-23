import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * User Language API (i18n preference)
 *
 * PATCH /api/user/language
 *   Body: { language: "en" | "id" | "es" | etc. }
 *
 * Updates the user's preferred language in the database.
 * The frontend can use this to load translations.
 */

// Supported languages
const SUPPORTED_LANGUAGES = ["en", "id", "es", "fr", "de", "pt", "ja", "ko", "zh"];

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const body = await request.json();
    const { language } = body;

    if (!language) {
      return NextResponse.json(
        { success: false, error: "Missing 'language' field" },
        { status: 400 },
      );
    }

    // Validate language code
    if (!SUPPORTED_LANGUAGES.includes(language)) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Unsupported language. Supported: ${SUPPORTED_LANGUAGES.join(", ")}` 
        },
        { status: 400 },
      );
    }

    const ctx = await getCloudflareContext();
    const d1 = ctx.env.DB as D1Database;

    // Update user's language preference
    await d1
      .prepare("UPDATE User SET language = ? WHERE id = ?")
      .bind(language, session.user.id)
      .run();

    return NextResponse.json({
      success: true,
      message: "Language updated",
      language,
    });
  } catch (error: any) {
    console.error("[LANGUAGE PATCH ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Failed to update language" },
      { status: 500 },
    );
  }
}
