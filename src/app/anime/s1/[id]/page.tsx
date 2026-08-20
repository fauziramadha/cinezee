import { AnimeDetailContent } from "@/components/anime/anime-detail-content";

export default async function Server1DetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AnimeDetailContent animeId={id} source="otakudesu" />;
}
