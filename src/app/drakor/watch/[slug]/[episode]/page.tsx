import { DrakorPlayer } from "@/components/drakor/drakor-player";

export const dynamic = "force-dynamic";

export default async function DrakorWatchPage({
  params,
}: {
  params: Promise<{ slug: string; episode: string }>;
}) {
  const { slug, episode } = await params;
  const cleanSlug = decodeURIComponent(slug).replace(/\/+$/, "").trim();
  const cleanEpisode = decodeURIComponent(episode).replace(/\/+$/, "").trim();
  return <DrakorPlayer drakorId={cleanSlug} episodeNumber={cleanEpisode} />;
}
