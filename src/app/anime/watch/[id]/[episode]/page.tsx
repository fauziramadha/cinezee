import { AnimePlayerContent } from "./anime-player";

export default async function AnimeWatchPage({
  params,
}: {
  params: Promise<{ id: string; episode: string }>;
}) {
  const { id, episode } = await params;
  return <AnimePlayerContent animeId={id} episodeId={episode} />;
}
