import { DonghuaS1ListContent } from "./content";

export const dynamic = "force-dynamic";

export default async function DonghuaS1ListPage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  try {
    const { type } = await params;
    const { page } = await searchParams;
    const cleanType = decodeURIComponent(type).replace(/\/+$/, "").trim().toLowerCase();
    const pageNum = Math.max(1, parseInt(page || "1", 10));
    return <DonghuaS1ListContent type={cleanType} page={pageNum} />;
  } catch (error) {
    console.error("[DonghuaS1ListPage] error:", error);
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-destructive mb-4">Failed to load list page</p>
          <a href="/donghua" className="text-sm text-primary hover:underline">Kembali ke Donghua</a>
        </div>
      </main>
    );
  }
}
