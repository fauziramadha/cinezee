/**
 * src/app/admin/layout.tsx
 *
 * Layout untuk semua admin pages.
 * - Cek login + role admin (kalau bukan admin → redirect ke home)
 * - Render admin nav di atas
 *
 * Semua page di /admin/* akan otomatis terbungkus layout ini.
 */

import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AdminNav } from "@/components/admin/admin-nav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/?callbackUrl=/admin");
  }

  if ((session.user as any).role !== "admin") {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <span className="text-sm text-muted-foreground">
            Logged in as {session.user.name || session.user.email}
          </span>
        </div>
        <div className="mb-6">
          <AdminNav />
        </div>
        {children}
      </div>
    </div>
  );
}
