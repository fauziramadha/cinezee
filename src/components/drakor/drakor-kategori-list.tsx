"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Clapperboard } from "lucide-react";
import { cn } from "@/lib/utils";

interface Kategori {
  id: string;
  title: string;
  count: number;
}

function unwrap(res: any): any {
  if (!res) return null;
  if (res.status === "error" || res.statusCode) return res;
  if (res.data !== undefined && res.code !== undefined) return res.data;
  return res;
}

export function DrakorKategoriList() {
  const router = useRouter();
  const [kategori, setKategori] = useState<Kategori[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchKategori = async () => {
      try {
        const res = await fetch("/api/drakor/kategori", { cache: "no-store" });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const json = await res.json();
        const inner = unwrap(json);
        const items = inner?.items || [];
        setKategori(items);
      } catch (err) {
        console.error("[DrakorKategori] error:", err);
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    };
    fetchKategori();
  }, []);

  const handleSelect = (slug: string) => {
    router.push("/drakor/kategori/" + slug);
  };

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-32 items-center justify-center">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (kategori.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center">
        <p className="text-sm text-muted-foreground">Tidak ada kategori.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2.5 p-4 sm:grid-cols-3">
      {kategori.map((k) => (
        <button
          key={k.id}
          onClick={() => handleSelect(k.id)}
          className={cn(
            "flex min-w-0 items-center gap-2 rounded-lg border border-border bg-card p-2.5 text-left text-xs font-medium transition-all",
            "hover:border-primary hover:bg-primary/10 hover:text-primary"
          )}
        >
          <Clapperboard className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <span className="block truncate">{k.title}</span>
            <span className="text-[10px] text-muted-foreground">{k.count} drakor</span>
          </div>
        </button>
      ))}
    </div>
  );
}
