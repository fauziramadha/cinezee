/**
 * src/app/admin/logs/page.tsx
 *
 * Halaman admin untuk view system logs.
 * Hanya bisa diakses admin (auth check ada di layout.tsx + page ini).
 *
 * URL: /admin/logs
 */

import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { LogsViewer } from "@/components/admin/logs-viewer";

export default async function AdminLogsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/?callbackUrl=/admin/logs");
  }

  if ((session.user as any).role !== "admin") {
    redirect("/");
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <LogsViewer />
    </div>
  );
}
