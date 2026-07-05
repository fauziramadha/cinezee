import { AnimePlayerContent } from "@/app/anime/watch/[id]/[episode]/anime-player";

export default async function SamehadakuWatchPage({
  params,
}: {
  params: Promise<{ id: string; episode: string }>;
}) {
  const { id, episode } = await params;
  return <AnimePlayerContent animeId={id} episodeId={episode} source="samehadaku" />;
}
