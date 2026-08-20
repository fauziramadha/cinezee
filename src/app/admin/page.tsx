/**
 * src/app/admin/page.tsx
 *
 * Halaman admin dashboard utama.
 * Hanya bisa diakses admin (auth check ada di layout.tsx + page ini).
 *
 * URL: /admin
 */

import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AdminDashboard } from "@/components/admin/admin-dashboard";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/?callbackUrl=/admin");
  }

  if ((session.user as any).role !== "admin") {
    redirect("/");
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <AdminDashboard />
    </div>
  );
}
