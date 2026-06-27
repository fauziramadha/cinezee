/**
 * src/components/pwa/install-prompt.tsx (REVISED - iOS Support)
 *
 * 2 Mode:
 * 1. Android/Chrome: beforeinstallprompt event → banner "Install"
 * 2. iOS/Safari: Deteksi iOS → banner "Add to Home Screen" dengan instruksi
 *
 * Dismiss disimpan di localStorage 7 hari.
 */

"use client";

import { useEffect, useState } from "react";
import { Download, X, Smartphone, Share } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "cinestream_install_dismissed";
const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 hari

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // === Cek apakah sudah di-install (standalone mode) ===
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(standalone);

    // Kalau sudah standalone, jangan tampilkan banner
    if (standalone) return;

    // === Cek dismiss sebelumnya ===
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed) {
      const dismissedTime = parseInt(dismissed, 10);
      if (Date.now() - dismissedTime < DISMISS_DURATION) {
        return;
      }
      localStorage.removeItem(DISMISS_KEY);
    }

    // === Deteksi iOS Safari ===
    const ua = window.navigator.userAgent.toLowerCase();
    const isiOS =
      /iphone|ipad|ipod/.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent);

    if (isiOS && isSafari) {
      setIsIOS(true);
      // Tampilkan instruksi iOS setelah 15 detik
      setTimeout(() => setShow(true), 15000);
      return;
    }

    // === Listener untuk Android/Chrome ===
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setShow(true), 30000);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    const handleAppInstalled = () => {
      setShow(false);
      setDeferredPrompt(null);
      localStorage.setItem(DISMISS_KEY, Date.now().toString());
    };

    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "dismissed") {
      localStorage.setItem(DISMISS_KEY, Date.now().toString());
    }
    setDeferredPrompt(null);
    setShow(false);
  };

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
  };

  if (!show || isStandalone) return null;

  // === IOS PROMPT (instruksi manual) ===
  if (isIOS) {
    return (
      <div
        style={{
          position: "fixed",
          bottom: "20px",
          left: "16px",
          right: "16px",
          zIndex: 9999,
          maxWidth: "400px",
          margin: "0 auto",
          animation: "slideUp 0.3s ease-out",
        }}
      >
        <style>{`
          @keyframes slideUp {
            from { transform: translateY(100%); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
        `}</style>

        <div
          style={{
            background: "linear-gradient(135deg, #B20710 0%, #8B0000 100%)",
            borderRadius: "16px",
            padding: "16px",
            boxShadow: "0 10px 40px rgba(0,0,0,0.4)",
            color: "white",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", marginBottom: "12px" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                background: "rgba(255,255,255,0.2)",
                borderRadius: "10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Smartphone style={{ width: "20px", height: "20px" }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: "14px", fontWeight: 700, margin: 0 }}>
                Install CineStream
              </p>
              <p style={{ fontSize: "12px", opacity: 0.9, margin: "2px 0 0 0" }}>
                Tonton offline & akses cepat dari home screen
              </p>
            </div>
            <button
              onClick={handleDismiss}
              aria-label="Dismiss"
              style={{
                background: "transparent",
                border: "none",
                color: "white",
                cursor: "pointer",
                padding: "4px",
                opacity: 0.8,
                flexShrink: 0,
              }}
            >
              <X style={{ width: "16px", height: "16px" }} />
            </button>
          </div>

          {/* Instruksi iOS */}
          <div
            style={{
              background: "rgba(0,0,0,0.3)",
              borderRadius: "8px",
              padding: "12px",
              fontSize: "12px",
              lineHeight: 1.5,
            }}
          >
            <p style={{ margin: 0, marginBottom: "8px", fontWeight: 600 }}>
              Cara install di iPhone:
            </p>
            <p style={{ margin: 0, marginBottom: "4px", display: "flex", alignItems: "center", gap: "6px" }}>
              <Share style={{ width: "14px", height: "14px", flexShrink: 0 }} />
              <span>Tap icon <strong>Share</strong> di bawah</span>
            </p>
            <p style={{ margin: 0, display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ width: "14px", textAlign: "center", flexShrink: 0 }}>2.</span>
              <span>Pilih <strong>"Add to Home Screen"</strong></span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // === ANDROID/CHROME PROMPT ===
  if (!deferredPrompt) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "20px",
        left: "16px",
        right: "16px",
        zIndex: 9999,
        maxWidth: "400px",
        margin: "0 auto",
        animation: "slideUp 0.3s ease-out",
      }}
    >
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>

      <div
        style={{
          background: "linear-gradient(135deg, #B20710 0%, #8B0000 100%)",
          borderRadius: "16px",
          padding: "16px",
          boxShadow: "0 10px 40px rgba(0,0,0,0.4)",
          color: "white",
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <div
          style={{
            width: "44px",
            height: "44px",
            background: "rgba(255,255,255,0.2)",
            borderRadius: "12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Smartphone style={{ width: "22px", height: "22px" }} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: "14px", fontWeight: 700, margin: 0 }}>
            Install CineStream
          </p>
          <p style={{ fontSize: "12px", opacity: 0.9, margin: "2px 0 0 0" }}>
            Akses cepat dari home screen + tonton offline
          </p>
        </div>

        <Button
          onClick={handleInstall}
          size="sm"
          style={{
            background: "white",
            color: "#B20710",
            border: "none",
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          <Download style={{ width: "14px", height: "14px", marginRight: "4px" }} />
          Install
        </Button>

        <button
          onClick={handleDismiss}
          aria-label="Dismiss"
          style={{
            background: "transparent",
            border: "none",
            color: "white",
            cursor: "pointer",
            padding: "4px",
            opacity: 0.8,
            flexShrink: 0,
          }}
        >
          <X style={{ width: "16px", height: "16px" }} />
        </button>
      </div>
    </div>
  );
}
