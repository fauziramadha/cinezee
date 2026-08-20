import { DonghuaPlayer } from "@/components/donghua/donghua-player";

export const dynamic = "force-dynamic";

export default async function S1WatchPage({ params }: { params: Promise<{ id: string; episode: string }> }) {
  try {
    const { id, episode } = await params;
    const cleanAnimeId = decodeURIComponent(id).replace(/\/+$/, "").trim();
    const cleanEpisodeId = decodeURIComponent(episode).replace(/\/+$/, "").trim();
    return <DonghuaPlayer animeId={cleanAnimeId} episodeId={cleanEpisodeId} source="s1" />;
  } catch (error) {
    console.error("[S1WatchPage] error:", error);
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-destructive mb-4">Failed to load player</p>
          <a href="/donghua" className="text-sm text-primary hover:underline">Kembali ke Donghua</a>
        </div>
      </main>
    );
  }
}
