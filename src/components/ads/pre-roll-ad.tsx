"use client";

import { useState, useEffect } from "react";

interface PreRollAdProps {
  adUrl: string;
  duration: number;
  skipDelay: number;
  onSkip: () => void;
}

export function PreRollAd({ adUrl, duration, skipDelay, onSkip }: PreRollAdProps) {
  const [countdown, setCountdown] = useState(duration);
  const [canSkip, setCanSkip] = useState(false);
  const [adError, setAdError] = useState(false);

  useEffect(() => {
    if (!adUrl) {
      onSkip();
      return;
    }

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    const skipTimer = setTimeout(() => {
      setCanSkip(true);
    }, skipDelay * 1000);

    return () => {
      clearInterval(timer);
      clearTimeout(skipTimer);
    };
  }, [adUrl, skipDelay, onSkip]);

  // Auto-skip when countdown reaches 0
  useEffect(() => {
    if (countdown === 0) {
      onSkip();
    }
  }, [countdown, onSkip]);

  if (!adUrl || adError) return null;

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black">
      {/* Ad label */}
      <div className="absolute left-3 top-3 z-10 rounded bg-black/70 px-2 py-1 text-[10px] font-medium text-white/60">
        Advertisement
      </div>

      {/* Ad iframe */}
      <iframe
        src={adUrl}
        className="h-full w-full border-0"
        allow="autoplay; fullscreen; encrypted-media"
        sandbox="allow-scripts allow-same-origin allow-presentation allow-forms allow-popups"
        onError={() => setAdError(true)}
        title="Advertisement"
      />

      {/* Skip button / countdown */}
      <div className="absolute bottom-4 right-4 z-10">
        {canSkip ? (
          <button
            onClick={onSkip}
            className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg transition-transform hover:scale-105"
          >
            Skip Ad
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </button>
        ) : (
          <div className="rounded-lg bg-black/70 px-4 py-2 text-sm text-white backdrop-blur-sm">
            Skip in {Math.max(0, skipDelay - (duration - countdown))}s
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
        <div
          className="h-full bg-primary transition-all duration-1000 ease-linear"
          style={{ width: `${((duration - countdown) / duration) * 100}%` }}
        />
      </div>
    </div>
  );
}
