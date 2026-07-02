"use client";

import { useState, useEffect } from "react";

interface PreRollAdConfig {
  preroll_url: string;
  duration: number;
  skip_delay: number;
}

interface PreRollAdProps {
  config: PreRollAdConfig;
  onComplete: () => void;
}

export function PreRollAd({ config, onComplete }: PreRollAdProps) {
  const [countdown, setCountdown] = useState(config.skip_delay);
  const [canSkip, setCanSkip] = useState(false);

  useEffect(() => {
    if (config.skip_delay <= 0) {
      setCanSkip(true);
      return;
    }

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setCanSkip(true);
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [config.skip_delay]);

  useEffect(() => {
    const maxTimer = setTimeout(() => {
      onComplete();
    }, config.duration * 1000);

    return () => clearTimeout(maxTimer);
  }, [config.duration, onComplete]);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 40,
        backgroundColor: "#000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {/* === Iframe dengan aspect ratio fleksibel === */}
      <iframe
        src={config.preroll_url}
        style={{
          width: "100%",
          height: "100%",
          border: "0",
          margin: "0",
          padding: "0",
          display: "block",
          objectFit: "contain",
        }}
        allow="autoplay; fullscreen; encrypted-media"
        sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
        scrolling="no"
        frameBorder="0"
        marginWidth={0}
        marginHeight={0}
        title="Advertisement"
      />

      {/* === Top bar: Ad label + Skip button === */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          padding: "8px 12px",
          background: "linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          pointerEvents: "none",
          zIndex: 10,
        }}
      >
        <span
          style={{
            color: "white",
            fontSize: "11px",
            fontWeight: 600,
            background: "rgba(0,0,0,0.6)",
            padding: "2px 6px",
            borderRadius: "4px",
          }}
        >
          Ad
        </span>

        {canSkip ? (
          <button
            onClick={onComplete}
            style={{
              pointerEvents: "auto",
              background: "rgba(255,255,255,0.9)",
              color: "#000",
              border: "none",
              padding: "6px 12px",
              borderRadius: "6px",
              fontSize: "11px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Skip Ad
          </button>
        ) : (
          <span
            style={{
              color: "white",
              fontSize: "11px",
              fontWeight: 500,
              background: "rgba(0,0,0,0.6)",
              padding: "4px 8px",
              borderRadius: "4px",
            }}
          >
            Skip in {countdown}s
          </span>
        )}
      </div>
    </div>
  );
}
