import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * NextAuth.js Catch-All Route Handler
 *
 * This file handles ALL auth-related endpoints:
 * - /api/auth/signin        → Login page
 * - /api/auth/signout       → Logout
 * - /api/auth/session       → Get current session
 * - /api/auth/callback/*    → OAuth callbacks (Google, etc.)
 * - /api/auth/error         → Error page
 * - /api/auth/providers     → List providers
 *
 * Usage in frontend:
 *   import { signIn, signOut, useSession } from "next-auth/react"
 *   signIn("google")              → Login with Google
 *   signIn("credentials", {...})  → Login with email/password
 *   signOut()                     → Logout
 *   const { data: session } = useSession()
 */

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
