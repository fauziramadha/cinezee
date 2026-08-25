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
    <main className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-red-600/10 text-3xl font-extrabold shadow-lg mx-auto">
          <span className="text-red-600">CS</span>
        </div>
        <h1 className="mb-2 text-2xl font-bold text-white">
          Terjadi Kesalahan
        </h1>
        <p className="mb-6 text-sm text-white/60">
          Halaman donghua gagal dimuat. Ini mungkin karena koneksi lambat atau
          cache browser yang lama.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700"
          >
            <RefreshCw className="h-4 w-4" />
            Coba Lagi
          </button>
          <Link
            href="/donghua"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/20 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
            Ke Beranda
          </Link>
        </div>
        {error?.message && (
          <p className="mt-6 text-xs text-white/40 break-all">
            {error.message}
          </p>
        )}
      </div>
    </main>
  );
}
