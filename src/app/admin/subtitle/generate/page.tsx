"use client";

import { SubtitleGenerate } from "@/components/admin/subtitle-generate";

export default function GenerateSubtitlePage() {
  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Auto-Generate Subtitle</h1>
          <p className="text-sm text-muted-foreground">
            Generate subtitle Indonesia otomatis menggunakan OpenAI Whisper di Google Colab.
            Tidak perlu install apa-apa — copy command, paste di Colab, run.
          </p>
        </div>

        <SubtitleGenerate />
      </div>
    </div>
  );
}
