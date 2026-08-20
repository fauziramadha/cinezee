import { drakor } from "@/lib/drakor-api";
import { DrakorPlayerView } from "@/components/drakor/drakor-player-view";

export const dynamic = "force-dynamic";

export default async function DrakorWatchPage({
  params,
}: {
  params: Promise<{ slug: string; episode: string }>;
}) {
  const { slug, episode } = await params;
  const cleanSlug = decodeURIComponent(slug).replace(/\/+$/, "").trim();
  const cleanEpisode = decodeURIComponent(episode).replace(/\/+$/, "").trim();

  try {
    // Fetch stream URL + detail in parallel
    const [playJson, detailJson] = await Promise.all([
      drakor.getPlay(cleanSlug, cleanEpisode),
      drakor.getDetail(cleanSlug),
    ]);

    const playData = playJson?.data || playJson;
    const detail = detailJson?.data || detailJson;

    return (
      <DrakorPlayerView
        drakorId={cleanSlug}
        episodeNumber={cleanEpisode}
        streamUrl={playData?.vid_url || playData?.vid_url_proxy || ""}
        detail={detail}
      />
    );
  } catch (error) {
    console.error("[DrakorWatchPage] error:", error);
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-destructive mb-4">Gagal memuat player</p>
          <a href={`/drakor/${cleanSlug}`} className="text-sm text-primary hover:underline">
            Kembali ke Detail
          </a>
        </div>
      </main>
    );
  }
}
