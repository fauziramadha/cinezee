/**
 * src/components/pwa/splash-screen.tsx
 *
 * Splash screen dengan animasi logo CineStream.
 * - Muncul saat app pertama dibuka
 * - Fade out smooth setelah 1.5 detik
 * - Auto-remove dari DOM setelah animasi selesai
 *
 * Cara pakai di layout.tsx:
 *   import { SplashOverlay } from "@/components/pwa/splash-screen";
 *   <SplashOverlay />
 */

"use client";

import { useEffect, useState } from "react";

export function SplashOverlay() {
  const [visible, setVisible] = useState(true);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    // Fade out setelah 1.5 detik
    const fadeTimer = setTimeout(() => {
      setRemoving(true);
    }, 1500);

    // Hapus dari DOM setelah animasi fade out selesai (500ms)
    const removeTimer = setTimeout(() => {
      setVisible(false);
    }, 2000);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "100vw",
        height: "100vh",
        height: "100dvh",
        backgroundColor: "#000000",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 999999,
        opacity: removing ? 0 : 1,
        transition: "opacity 0.5s ease-out",
        pointerEvents: removing ? "none" : "auto",
      }}
    >
      {/* === Logo Container === */}
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "32px",
        }}
      >
        {/* Pulsing rings (decorative) */}
        <div
          style={{
            position: "absolute",
            width: "120px",
            height: "120px",
            borderRadius: "50%",
            border: "2px solid rgba(178, 7, 16, 0.3)",
            animation: "splashPulse 1.5s ease-out infinite",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: "120px",
            height: "120px",
            borderRadius: "50%",
            border: "2px solid rgba(178, 7, 16, 0.3)",
            animation: "splashPulse 1.5s ease-out infinite 0.5s",
          }}
        />

        {/* Logo Box */}
        <div
          style={{
            width: "80px",
            height: "80px",
            background: "linear-gradient(135deg, #B20710 0%, #8B0000 100%)",
            borderRadius: "20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 10px 40px rgba(178, 7, 16, 0.5)",
            animation: "splashBounce 0.6s ease-out",
          }}
        >
          <span
            style={{
              color: "white",
              fontSize: "32px",
              fontWeight: 800,
              letterSpacing: "-1px",
            }}
          >
            CS
          </span>
        </div>
      </div>

      {/* === App Name === */}
      <h1
        style={{
          color: "white",
          fontSize: "28px",
          fontWeight: 700,
          letterSpacing: "-0.5px",
          margin: 0,
          marginBottom: "8px",
          animation: "splashFadeUp 0.6s ease-out 0.2s both",
        }}
      >
        Cine<span style={{ color: "#B20710" }}>Stream</span>
      </h1>

      {/* === Tagline === */}
      <p
        style={{
          color: "rgba(255, 255, 255, 0.5)",
          fontSize: "12px",
          fontWeight: 400,
          margin: 0,
          marginBottom: "32px",
          animation: "splashFadeUp 0.6s ease-out 0.4s both",
        }}
      >
        Streaming tanpa batas
      </p>

      {/* === Loading Dots === */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          animation: "splashFadeUp 0.6s ease-out 0.6s both",
        }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              backgroundColor: "#B20710",
              animation: `splashDot 1.4s ease-in-out infinite ${i * 0.16}s`,
            }}
          />
        ))}
      </div>

      {/* === CSS Keyframes (inline) === */}
      <style>{`
        @keyframes splashPulse {
          0% {
            transform: scale(1);
            opacity: 0.8;
          }
          100% {
            transform: scale(1.8);
            opacity: 0;
          }
        }

        @keyframes splashBounce {
          0% {
            transform: scale(0.3);
            opacity: 0;
          }
          50% {
            transform: scale(1.05);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        @keyframes splashFadeUp {
          0% {
            transform: translateY(10px);
            opacity: 0;
          }
          100% {
            transform: translateY(0);
            opacity: 1;
          }
        }

        @keyframes splashDot {
          0%, 80%, 100% {
            transform: scale(0.6);
            opacity: 0.4;
          }
          40% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
