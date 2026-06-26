/**
 * src/app/admin/users/page.tsx
 *
 * Halaman admin untuk manage users.
 * Hanya bisa diakses admin (auth check ada di layout.tsx + page ini).
 *
 * URL: /admin/users
 */

import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { UserManager } from "@/components/admin/user-manager";

export default async function AdminUsersPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/?callbackUrl=/admin/users");
  }

  if ((session.user as any).role !== "admin") {
    redirect("/");
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <UserManager />
    </div>
  );
}
