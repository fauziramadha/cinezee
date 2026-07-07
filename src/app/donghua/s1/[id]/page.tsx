import { DonghuaDetailContent } from "@/components/donghua/donghua-detail-content";

export const dynamic = "force-dynamic";

export default async function S1DetailPage({ params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    // Strip any trailing slashes from slug (API sometimes returns "xxx/")
    const cleanSlug = decodeURIComponent(id).replace(/\/+$/, "").trim();
    return <DonghuaDetailContent slug={cleanSlug} source="s1" />;
  } catch (error) {
    console.error("[S1DetailPage] error:", error);
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-destructive mb-4">Failed to load detail page</p>
          <a href="/donghua" className="text-sm text-primary hover:underline">Kembali ke Donghua</a>
        </div>
      </main>
    );
  }
}
