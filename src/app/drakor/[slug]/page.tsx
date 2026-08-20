import { drakor } from "@/lib/drakor-api";
import { DrakorDetailView } from "@/components/drakor/drakor-detail-view";

export const dynamic = "force-dynamic";

export default async function DrakorDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const cleanSlug = decodeURIComponent(slug).replace(/\/+$/, "").trim();

  try {
    const json = await drakor.getDetail(cleanSlug);
    const detail = json?.data || json;

    if (!detail || (!detail.title && !detail.id)) {
      return (
        <main className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <p className="text-sm text-destructive mb-4">Drakor tidak ditemukan</p>
            <a href="/drakor" className="text-sm text-primary hover:underline">Kembali ke Drakor</a>
          </div>
        </main>
      );
    }

    return <DrakorDetailView detail={detail} />;
  } catch (error) {
    console.error("[DrakorDetailPage] error:", error);
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-destructive mb-4">Gagal memuat detail</p>
          <a href="/drakor" className="text-sm text-primary hover:underline">Kembali ke Drakor</a>
        </div>
      </main>
    );
  }
}
