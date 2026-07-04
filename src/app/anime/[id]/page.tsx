import { AnimeDetailContent } from "./anime-detail-content";

export default async function AnimeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AnimeDetailContent animeId={id} />;
}
