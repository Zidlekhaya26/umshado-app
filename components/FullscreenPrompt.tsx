"use client";

import React, { useEffect, useState } from "react";

export default function FullscreenPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [visible, setVisible] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    const onBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall as EventListener);

    const ua = typeof navigator !== "undefined" ? navigator.userAgent.toLowerCase() : "";
    const ios = /iphone|ipad|ipod/.test(ua) && !(window as any).navigator?.standalone;
    setIsIos(!!ios);
    if (ios) setVisible(true);

    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall as EventListener);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      try {
        await deferredPrompt.userChoice;
      } catch (_) {}
      setDeferredPrompt(null);
      setVisible(false);
    } else if (isIos) {
      // iOS cannot be prompted programmatically — give short instructions
      alert("To add uMshado to your home screen: tap Share → Add to Home Screen.");
      setVisible(false);
    }
  };

  const enterFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch (err) {
      console.warn("Fullscreen request failed", err);
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-white border rounded-lg shadow-lg p-3 flex items-center gap-3 max-w-md" role="dialog" aria-label="Install or fullscreen prompt">
        <div className="text-sm text-gray-800">For a native fullscreen experience, install the app or enter fullscreen.</div>
        <div className="flex items-center gap-2">
          <button onClick={handleInstall} className="px-3 py-1 bg-purple-600 text-white rounded-md text-sm">Install</button>
          <button onClick={enterFullscreen} className="px-3 py-1 bg-gray-200 text-gray-800 rounded-md text-sm">Fullscreen</button>
          <button onClick={() => setVisible(false)} className="text-sm text-gray-600">Dismiss</button>
        </div>
      </div>
    </div>
  );
}
