import { DonghuaS1ListContent } from "./content";

export const dynamic = "force-dynamic";

export default async function DonghuaS1ListPage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { type } = await params;
  const { page } = await searchParams;
  const pageNum = Math.max(1, parseInt(page || "1", 10));
  return <DonghuaS1ListContent type={type} page={pageNum} />;
}
