"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

const DISMISSED_KEY = "umshado_install_banner_dismissed";

export default function AppInstallBanner() {
  const [visible, setVisible] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosInstructions, setShowIosInstructions] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Already installed as PWA — hide forever
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setInstalled(true);
      return;
    }
    // User dismissed before — respect it for 7 days
    const dismissed = localStorage.getItem(DISMISSED_KEY);
    if (dismissed && Date.now() - Number(dismissed) < 7 * 24 * 60 * 60 * 1000) return;

    const ua = navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(ua) && !(navigator as any).standalone;

    if (ios) {
      setIsIos(true);
      setTimeout(() => setVisible(true), 3000);
      return;
    }

    // Android / Chrome — wait for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setTimeout(() => setVisible(true), 3000);
    };
    window.addEventListener("beforeinstallprompt", handler as EventListener);
    return () => window.removeEventListener("beforeinstallprompt", handler as EventListener);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    setVisible(false);
    setShowIosInstructions(false);
  };

  const handleInstall = async () => {
    if (isIos) {
      setShowIosInstructions(true);
      return;
    }
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setInstalled(true);
        setVisible(false);
      }
      setDeferredPrompt(null);
    }
  };

  if (installed || !visible) return null;

  const CR = "#9A2143";
  const GD = "#BD983F";

  return (
    <>
      {/* iOS instructions sheet */}
      {showIosInstructions && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.6)", display: "flex",
            alignItems: "flex-end", justifyContent: "center",
          }}
          onClick={dismiss}
        >
          <div
            style={{
              background: "#fff", borderRadius: "20px 20px 0 0",
              padding: "28px 24px 40px", width: "100%", maxWidth: 480,
              textAlign: "center",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 36, marginBottom: 8 }}>📲</div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: CR, margin: "0 0 8px" }}>
              Add uMshado to your Home Screen
            </h3>
            <p style={{ fontSize: 14, color: "#555", lineHeight: 1.6, margin: "0 0 20px" }}>
              1. Tap the <strong>Share</strong> button <span style={{ fontSize: 18 }}>⎙</span> at the bottom of Safari<br />
              2. Scroll down and tap <strong>"Add to Home Screen"</strong><br />
              3. Tap <strong>Add</strong> — the app will appear on your home screen!
            </p>
            {/* Arrow pointing down to Safari share bar */}
            <div style={{
              background: "#f4f0f8", borderRadius: 12, padding: "10px 16px",
              fontSize: 13, color: "#666", marginBottom: 20,
            }}>
              The uMshado app works offline, loads instantly, and feels native — just like a real app.
            </div>
            <button
              onClick={dismiss}
              style={{
                width: "100%", padding: "14px", borderRadius: 12,
                background: CR, color: "#fff", fontWeight: 700,
                fontSize: 15, border: "none", cursor: "pointer",
              }}
            >
              Got it!
            </button>
          </div>
        </div>
      )}

      {/* Sticky bottom banner */}
      {!showIosInstructions && (
        <div
          style={{
            position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 1000,
            background: "#fff",
            borderTop: `3px solid ${CR}`,
            boxShadow: "0 -4px 24px rgba(154,33,67,0.15)",
            padding: "12px 16px",
            display: "flex", alignItems: "center", gap: 12,
            animation: "slideUp 0.4s ease",
          }}
        >
          <style>{`
            @keyframes slideUp {
              from { transform: translateY(100%); opacity: 0; }
              to   { transform: translateY(0);    opacity: 1; }
            }
          `}</style>

          {/* Logo */}
          <div style={{ flexShrink: 0 }}>
            <Image
              src="/logo-icon.png"
              alt="uMshado"
              width={44}
              height={44}
              style={{ borderRadius: 10 }}
            />
          </div>

          {/* Text */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#1a0d12", lineHeight: 1.3 }}>
              Get the uMshado App
            </div>
            <div style={{ fontSize: 12, color: "#666", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {isIos ? "Add to Home Screen for the best experience" : "Install free — works offline, feels native"}
            </div>
          </div>

          {/* CTA */}
          <button
            onClick={handleInstall}
            style={{
              flexShrink: 0,
              background: `linear-gradient(135deg, ${CR}, ${GD})`,
              color: "#fff", fontWeight: 700, fontSize: 13,
              border: "none", borderRadius: 10, padding: "10px 16px",
              cursor: "pointer", whiteSpace: "nowrap",
            }}
          >
            {isIos ? "How to Install" : "Install Now"}
          </button>

          {/* Dismiss */}
          <button
            onClick={dismiss}
            aria-label="Dismiss"
            style={{
              flexShrink: 0, background: "none", border: "none",
              fontSize: 20, color: "#aaa", cursor: "pointer", padding: "0 4px",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
      )}
    </>
  );
}
