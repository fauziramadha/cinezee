import { DonghuaPlayer } from "@/components/donghua/donghua-player";
export default async function S2WatchPage({ params }: { params: Promise<{ id: string; episode: string }> }) {
  const { id, episode } = await params;
  return <DonghuaPlayer animeId={id} episodeId={episode} source="s2" />;
}
