/**
 * src/app/admin/analytics/page.tsx
 *
 * Halaman admin untuk analytics dashboard.
 * Hanya bisa diakses admin (auth check ada di layout.tsx + page ini juga).
 *
 * URL: /admin/analytics
 */

import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AnalyticsDashboard } from "@/components/admin/analytics-dashboard";

export default async function AdminAnalyticsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/?callbackUrl=/admin/analytics");
  }

  if ((session.user as any).role !== "admin") {
    redirect("/");
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <AnalyticsDashboard />
    </div>
  );
}
