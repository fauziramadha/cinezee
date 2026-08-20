/**
 * src/app/admin/providers/page.tsx
 *
 * Halaman admin untuk manage streaming providers.
 * Hanya bisa diakses admin (auth check ada di layout.tsx).
 *
 * URL: /admin/providers
 */

import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { ProviderManager } from "@/components/admin/provider-manager";

export default async function AdminProvidersPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/?callbackUrl=/admin/providers");
  }

  if ((session.user as any).role !== "admin") {
    redirect("/");
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <ProviderManager />
    </div>
  );
}
