import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getDb } from "@/lib/db";

/**
 * POST /api/auth/register
 *
 * Register a new user with email & password.
 *
 * Request body:
 *   {
 *     "email": "user@example.com",
 *     "password": "secret123",
 *     "name": "John Doe"  // optional
 *   }
 *
 * Response (201):
 *   {
 *     "success": true,
 *     "user": {
 *       "id": "cuid",
 *       "email": "user@example.com",
 *       "name": "John Doe"
 *     }
 *   }
 *
 * Response (400 - validation error):
 *   {
 *     "success": false,
 *     "error": "Email dan password wajib diisi"
 *   }
 *
 * Response (409 - email already exists):
 *   {
 *     "success": false,
 *     "error": "Email sudah terdaftar"
 *   }
 *
 * Note: After registration, frontend should call signIn("credentials", {...})
 * to automatically log the user in.
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name } = body;

    // 1. Validate input
    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Email dan password wajib diisi" },
        { status: 400 },
      );
    }

    // 2. Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: "Format email tidak valid" },
        { status: 400 },
      );
    }

    // 3. Validate password length (min 8 chars)
    if (password.length < 8) {
      return NextResponse.json(
        { success: false, error: "Password minimal 8 karakter" },
        { status: 400 },
      );
    }

    // 4. Validate password max length (max 100 chars)
    if (password.length > 100) {
      return NextResponse.json(
        { success: false, error: "Password maksimal 100 karakter" },
        { status: 400 },
      );
    }

    // 5. Normalize email (lowercase)
    const normalizedEmail = email.toLowerCase().trim();

    // 6. Connect to D1 database
    const db = await getDb();

    // 7. Check if email already exists
    const existingUser = await db.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: "Email sudah terdaftar" },
        { status: 409 },
      );
    }

    // 8. Hash password with bcrypt (10 rounds = good balance of security & speed)
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 9. Create user in database
    const user = await db.user.create({
      data: {
        email: normalizedEmail,
        password: hashedPassword,
        name: name?.trim() || null,
        role: "user",
        language: "en",
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    });

    // 10. Return success response (without password)
    return NextResponse.json(
      {
        success: true,
        user,
        message:
          "Registrasi berhasil. Silakan login dengan email dan password Anda.",
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[REGISTER ERROR]", error);

    // Handle JSON parse error
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { success: false, error: "Request body tidak valid (JSON salah)" },
        { status: 400 },
      );
    }

    // Handle database errors
    if (error && typeof error === "object" && "code" in error) {
      const prismaError = error as { code: string; message: string };
      if (prismaError.code === "P2002") {
        return NextResponse.json(
          { success: false, error: "Email sudah terdaftar" },
          { status: 409 },
        );
      }
    }

    // Generic error
    return NextResponse.json(
      {
        success: false,
        error: "Terjadi kesalahan server. Silakan coba lagi.",
      },
      { status: 500 },
    );
  }
}

/**
 * GET /api/auth/register
 *
 * Return 405 Method Not Allowed (only POST is allowed)
 */
export async function GET() {
  return NextResponse.json(
    { success: false, error: "Method GET tidak diizinkan" },
    { status: 405 },
  );
}
