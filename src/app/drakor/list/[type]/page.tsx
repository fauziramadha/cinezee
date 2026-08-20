import { DrakorListContent } from "./content";

export const dynamic = "force-dynamic";

export default async function DrakorListPage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { type } = await params;
  const { page } = await searchParams;
  const cleanType = decodeURIComponent(type).replace(/\/+$/, "").trim().toLowerCase();
  const pageNum = Math.max(1, parseInt(page || "1", 10));
  return <DrakorListContent type={cleanType} page={pageNum} />;
}
