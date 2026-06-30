import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AdManager } from "@/components/admin/ad-manager";

export default async function AdminAdsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/?callbackUrl=/admin/ads");
  }

  if ((session.user as any).role !== "admin") {
    redirect("/");
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <AdManager />
    </div>
  );
}
