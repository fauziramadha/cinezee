import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { getDb } from "@/lib/db";

/**
 * NextAuth.js Configuration
 *
 * Supports:
 * - Google OAuth (login with Google account)
 * - Email/Password (login with credentials)
 * - JWT session (works in Cloudflare Workers)
 * - Role-based access (user/admin)
 */

export const authOptions: NextAuthOptions = {
  adapter: {
    createUser: async (data) => {
      const db = getDb();
      return db.user.create({ data });
    },
    getUser: async (id) => {
      const db = getDb();
      return db.user.findUnique({ where: { id } });
    },
    getUserByEmail: async (email) => {
      const db = getDb();
      return db.user.findUnique({ where: { email } });
    },
    getUserByProviderAccountId: async (providerAccountId, provider) => {
      const db = getDb();
      const account = await db.account.findUnique({
        where: { provider_providerAccountId: { provider, providerAccountId } },
        include: { user: true },
      });
      return account?.user ?? null;
    },
    updateUser: async (data) => {
      const db = getDb();
      return db.user.update({ where: { id: data.id ?? "" }, data });
    },
    deleteUser: async (userId) => {
      const db = getDb();
      return db.user.delete({ where: { id: userId } });
    },
    linkAccount: async (account) => {
      const db = getDb();
      return db.account.create({ data: account });
    },
    unlinkAccount: async (providerAccountId, provider) => {
      const db = getDb();
      await db.account.delete({
        where: { provider_providerAccountId: { provider, providerAccountId } },
      });
    },
    createSession: async (session) => {
      const db = getDb();
      return db.session.create({ data: session });
    },
    getSession: async (sessionToken) => {
      const db = getDb();
      return db.session.findUnique({ where: { sessionToken } });
    },
    updateSession: async (session) => {
      const db = getDb();
      return db.session.update({
        where: { sessionToken: session.sessionToken },
        data: session,
      });
    },
    deleteSession: async (sessionToken) => {
      const db = getDb();
      await db.session.delete({ where: { sessionToken } });
    },
    createVerificationToken: async (data) => {
      const db = getDb();
      return db.verificationToken.create({ data });
    },
    useVerificationToken: async (identifier, token) => {
      const db = getDb();
      try {
        return await db.verificationToken.delete({
          where: { identifier_token: { identifier, token } },
        });
      } catch {
        return null;
      }
    },
  } as any,

  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),

    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email dan password wajib diisi");
        }

        const db = getDb();
        const user = await db.user.findUnique({
          where: { email: credentials.email.toLowerCase() },
        });

        if (!user) {
          throw new Error("Email tidak terdaftar");
        }

        if (!user.password) {
          throw new Error(
            "Akun ini terdaftar via Google. Silakan login dengan Google.",
          );
        }

        if (user.banned) {
          throw new Error("Akun Anda telah diblokir. Hubungi admin.");
        }

        const isValid = await bcrypt.compare(
          credentials.password,
          user.password,
        );
        if (!isValid) {
          throw new Error("Password salah");
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          image: user.image ?? undefined,
          role: user.role,
        };
      },
    }),
  ],

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role ?? "user";
        token.language = (user as any).language ?? "en";
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as any).role = token.role as string;
        (session.user as any).language = token.language as string;
      }
      return session;
    },

    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
  },

  pages: {
    signIn: "/",
    error: "/",
  },

  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === "development",
};

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: string;
      language: string;
    };
  }

  interface User {
    role?: string;
    language?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    language?: string;
  }
}
