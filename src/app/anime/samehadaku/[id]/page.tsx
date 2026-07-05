import { AnimeDetailContent } from "@/app/anime/[id]/anime-detail-content";

export default async function SamehadakuDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AnimeDetailContent animeId={id} source="samehadaku" />;
}
