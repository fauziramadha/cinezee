import { drakor } from "@/lib/drakor-api";
import { DrakorKategoriView } from "./content";

export const dynamic = "force-dynamic";

export default async function DrakorKategoriPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug } = await params;
  const { page } = await searchParams;
  const cleanSlug = decodeURIComponent(slug).replace(/\/+$/, "").trim();
  const pageNum = Math.max(1, parseInt(page || "1", 10));

  try {
    // Fetch kategori detail + list semua kategori (untuk tab/links)
    const [kategoriJson, allKategoriJson] = await Promise.all([
      drakor.getByKategori(cleanSlug, pageNum),
      drakor.getKategori(),
    ]);

    const kategoriData = kategoriJson?.data || kategoriJson;
    const allKategoriData = allKategoriJson?.data || allKategoriJson;

    return (
      <DrakorKategoriView
        slug={cleanSlug}
        page={pageNum}
        items={kategoriData?.items || []}
        total={kategoriData?.total || 0}
        allKategori={allKategoriData?.items || []}
      />
    );
  } catch (error) {
    console.error("[DrakorKategoriPage] error:", error);
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-destructive mb-4">Gagal memuat kategori</p>
          <a href="/drakor" className="text-sm text-primary hover:underline">Kembali ke Drakor</a>
        </div>
      </main>
    );
  }
}
