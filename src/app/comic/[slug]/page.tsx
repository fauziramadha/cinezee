import { ComicDetailContent } from "@/components/comic/comic-detail-content";

export default async function ComicDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <ComicDetailContent slug={slug} />;
}
