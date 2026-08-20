import { AnimePlayerContent } from "@/components/anime/anime-player";

export default async function Server2WatchPage({
  params,
}: {
  params: Promise<{ id: string; episode: string }>;
}) {
  const { id, episode } = await params;
  return <AnimePlayerContent animeId={id} episodeId={episode} source="animasu" />;
}
