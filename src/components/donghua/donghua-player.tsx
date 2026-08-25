"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/cinepro/header";
import { Footer } from "@/components/cinepro/footer";
import { SearchModal } from "@/components/cinepro/search-modal";
import { DetailModal } from "@/components/cinepro/detail-modal";
import { PlayerModal } from "@/components/cinepro/player-modal";
import { AuthModal } from "@/components/cinepro/auth-modal";
import { Loader2, AlertCircle, ArrowLeft, ChevronLeft, ChevronRight, Server, Download, X, Maximize, Minimize, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface DonghuaPlayerProps {
  animeId: string;
  episodeId: string;
  source: "s1" | "s2";
}

export function DonghuaPlayer({ animeId, episodeId, source }: DonghuaPlayerProps) {
  const router = useRouter();
  const [episode, setEpisode] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [streams, setStreams] = useState<any[]>([]);
  const [selectedStreamIdx, setSelectedStreamIdx] = useState(0);
  const [streamUrl, setStreamUrl] = useState("");
  const [iframeLoading, setIframeLoading] = useState(true);
  const [iframeError, setIframeError] = useState(false);
  const [showOpenInNewTab, setShowOpenInNewTab] = useState(false);
  const [showDownload, setShowDownload] = useState(false);
  const [downloads, setDownloads] = useState<any[]>([]);
  const [prevEpSlug, setPrevEpSlug] = useState<string | null>(null);
  const [nextEpSlug, setNextEpSlug] = useState<string | null>(null);
  const [seriesSlug, setSeriesSlug] = useState<string>(animeId);
  const playerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLoading(true); setError(null); setStreamUrl(""); setIframeLoading(true); setIframeError(false); setShowOpenInNewTab(false);
    // Both s1 and s2 use the same VPS FastAPI endpoint now
    const endpoint = `/api/donghua/episode/${episodeId}`;
    fetch(endpoint)
      .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .then((json) => {
        if (!json) throw new Error("Invalid response");
        setEpisode(json);
        // VPS FastAPI episode format:
        // { title, sources: [{name, url}], default_source, prev_episode, next_episode }
        const rawStreams = Array.isArray(json.sources) ? json.sources : [];
        const normalizedStreams = rawStreams.map((s: any) => ({ name: s.name || s.server || "Unknown", url: s.url }));
        setStreams(normalizedStreams);
        if (normalizedStreams.length > 0) {
          setSelectedStreamIdx(0);
          setStreamUrl(normalizedStreams[0].url);
          setIframeLoading(false);
        }
        // No downloads from VPS FastAPI currently
        setDownloads([]);
        // Navigation
        setPrevEpSlug(json.prev_episode || null);
        setNextEpSlug(json.next_episode || null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [episodeId, source]);

  useEffect(() => {
    if (!streamUrl || iframeError) return;
    timeoutRef.current = setTimeout(() => { if (iframeLoading) { setShowOpenInNewTab(true); setIframeLoading(false); } }, 8000);
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [streamUrl, iframeLoading, iframeError]);

  const handleStreamChange = (idx: number) => { setSelectedStreamIdx(idx); setStreamUrl(streams[idx].url); setIframeLoading(true); setIframeError(false); setShowOpenInNewTab(false); };
  const switchServer = useCallback(() => { if (streams.length > 0) handleStreamChange((selectedStreamIdx + 1) % streams.length); }, [streams, selectedStreamIdx]);
  const toggleFullscreen = () => { if (!document.fullscreenElement) { playerRef.current?.requestFullscreen?.(); } else { document.exitFullscreen?.(); } };
  const watchBase = source === "s2" ? `/donghua/s2/watch/${seriesSlug}` : `/donghua/s1/watch/${seriesSlug}`;
  const detailHref = source === "s2" ? `/donghua/s2/${seriesSlug}` : `/donghua/s1/${seriesSlug}`;
  const title = episode?.title || "Episode";

  if (loading) return (<main className="min-h-screen bg-background"><Header /><div className="flex h-[60vh] items-center justify-center pt-20"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div><Footer /><SearchModal /><DetailModal /><PlayerModal /><AuthModal /></main>);
  if (error || !episode) return (<main className="min-h-screen bg-background"><Header /><div className="flex h-[60vh] flex-col items-center justify-center gap-3 pt-20 text-center"><AlertCircle className="h-10 w-10 text-destructive" /><p className="text-sm text-destructive">{error || "Tidak ditemukan"}</p><Button variant="secondary" size="sm" onClick={() => router.push(detailHref)} className="gap-1.5"><ArrowLeft className="h-3.5 w-3.5" />Kembali</Button></div><Footer /><SearchModal /><DetailModal /><PlayerModal /><AuthModal /></main>);

  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-6 pt-20">
        <button onClick={() => router.push(detailHref)} className="mb-4 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Kembali ke Detail</button>
        <h1 className="mb-4 line-clamp-1 text-lg font-bold sm:text-xl">{title}</h1>
        <div ref={playerRef} className="relative aspect-video w-full overflow-hidden rounded-lg bg-black" style={{ minHeight: "200px" }}>
          {iframeLoading && <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white"><Loader2 className="h-10 w-10 animate-spin text-primary" /><p className="text-sm text-white/70">Loading...</p></div>}
          {streamUrl && !iframeError && <iframe key={streamUrl} src={streamUrl} className="h-full w-full" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowFullScreen referrerPolicy="origin" onLoad={() => { setIframeLoading(false); if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; } }} onError={() => { setIframeError(true); setIframeLoading(false); }} title={title} />}
          {iframeError && <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black p-6 text-center text-white"><AlertCircle className="h-12 w-12 text-red-500" /><div><p className="mb-1 text-base font-semibold">Playback Error</p><p className="text-sm text-white/60">Coba server lain.</p></div><div className="flex gap-2"><Button onClick={switchServer} size="sm" className="gap-2"><Server className="h-3.5 w-3.5" />Server Lain</Button>{streamUrl && <a href={streamUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-md border border-white/30 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"><ExternalLink className="h-3.5 w-3.5" />Tab Baru</a>}</div></div>}
          {showOpenInNewTab && streamUrl && !iframeError && <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black p-6 text-center text-white"><AlertCircle className="h-10 w-10 text-yellow-500" /><div><p className="mb-1 text-sm font-semibold">Video tidak bisa di-embed</p><p className="text-xs text-white/60">Buka di tab baru.</p></div><div className="flex gap-2"><a href={streamUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"><ExternalLink className="h-3.5 w-3.5" />Tab Baru</a><Button onClick={switchServer} size="sm" variant="outline" className="gap-2"><Server className="h-3.5 w-3.5" />Server Lain</Button></div></div>}
          {!iframeLoading && !iframeError && !showOpenInNewTab && <button onClick={toggleFullscreen} className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm hover:bg-primary"><Maximize className="h-4 w-4" /></button>}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => prevEpSlug && router.push(`${watchBase}/${prevEpSlug}`)} disabled={!prevEpSlug} className="gap-1.5"><ChevronLeft className="h-4 w-4" />Prev</Button>
            <Button size="sm" variant="outline" onClick={() => nextEpSlug && router.push(`${watchBase}/${nextEpSlug}`)} disabled={!nextEpSlug} className="gap-1.5">Next<ChevronRight className="h-4 w-4" /></Button>
          </div>
          {downloads.length > 0 && <Button size="sm" variant="outline" onClick={() => setShowDownload(!showDownload)} className="gap-1.5"><Download className="h-4 w-4" />Download</Button>}
        </div>
        {streams.length > 0 && (
          <div className="mt-4 rounded-lg border border-border bg-card p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Server className="h-4 w-4 text-primary" />Pilih Server</h3>
            <div className="flex items-center gap-2"><span className="text-xs text-muted-foreground">Server:</span><Select value={String(selectedStreamIdx)} onValueChange={(v) => handleStreamChange(parseInt(v, 10))}><SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger><SelectContent>{streams.map((s, idx) => <SelectItem key={idx} value={String(idx)}>{s.name}</SelectItem>)}</SelectContent></Select></div>
            <p className="mt-2 text-[11px] text-muted-foreground">💡 Kalau video tidak muncul, coba server lain.</p>
          </div>
        )}
        {showDownload && downloads.length > 0 && (
          <div className="mt-4 rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between"><h3 className="flex items-center gap-2 text-sm font-bold"><Download className="h-4 w-4 text-primary" />Link Download</h3><button onClick={() => setShowDownload(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button></div>
            <div className="space-y-3">{downloads.map((q, idx) => <div key={idx} className="rounded border border-border p-3"><div className="mb-2"><Badge variant="outline">{q.title || q.name || "Download"}</Badge></div><div className="flex flex-wrap gap-2">{(q.urls || []).map((u: any, uidx: number) => <a key={uidx} href={u.url} target="_blank" rel="noopener noreferrer" className="rounded bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20">{u.title || u.host || `Link ${uidx + 1}`}</a>)}</div></div>)}</div>
          </div>
        )}
      </div>
      <Footer /><SearchModal /><DetailModal /><PlayerModal /><AuthModal />
    </main>
  );
}
