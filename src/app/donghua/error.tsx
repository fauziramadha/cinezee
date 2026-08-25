"use client";

import { useEffect } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import Link from "next/link";

export default function DonghuaError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Donghua Page Error]", error);
  }, [error]);

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 text-3xl font-extrabold shadow-lg mx-auto">
          <span className="text-primary">CS</span>
        </div>
        <h1 className="mb-2 text-2xl font-bold text-foreground">
          Terjadi Kesalahan
        </h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Halaman donghua gagal dimuat. Ini mungkin karena koneksi lambat atau
          cache browser yang lama.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <RefreshCw className="h-4 w-4" />
            Coba Lagi
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-6 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" />
            Ke Beranda
          </Link>
        </div>
        {error?.message && (
          <p className="mt-6 text-xs text-muted-foreground/60 break-all">
            {error.message}
          </p>
        )}
      </div>
    </main>
  );
}
