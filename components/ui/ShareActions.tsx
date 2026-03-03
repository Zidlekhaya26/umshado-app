"use client";

import { useState } from "react";
import { SharePayload, shareLink, buildWhatsAppLink } from "../../lib/share";

type Props = {
  payload: SharePayload;
  open: boolean;
  onClose: () => void;
};

export default function ShareActions({ payload, open, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(payload.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      setCopied(false);
    }
  };

  const onWhatsApp = () => {
    const message = payload.text || payload.title;
    const link = buildWhatsAppLink(message, payload.url);
    window.open(link, "_blank", "noopener");
    onClose();
  };

  const onNativeShare = async () => {
    const res = await shareLink(payload);
    if (res.ok && res.usedNative) onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} aria-hidden />
      <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center p-4 pb-8">
        <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 bg-gray-200 rounded-full" />
          </div>
          <div className="px-5 pb-5">
            <p className="text-base font-bold text-gray-900 mb-4 text-center">Share</p>

            <button
              onClick={onWhatsApp}
              className="w-full flex items-center gap-3 bg-green-500 text-white px-4 py-3.5 rounded-xl font-semibold text-sm mb-3 hover:bg-green-600 transition-colors"
            >
              <svg viewBox="0 0 32 32" className="w-5 h-5 fill-white shrink-0" aria-hidden="true">
                <path d="M16 0C7.164 0 0 7.163 0 16c0 2.833.738 5.493 2.031 7.807L0 32l8.418-2.004A15.93 15.93 0 0 0 16 32c8.837 0 16-7.163 16-16S24.837 0 16 0zm8.322 22.678c-.344.967-2.01 1.847-2.756 1.965-.746.118-1.679.167-2.71-.17-1.619-.529-3.32-1.42-4.76-2.86-2.08-2.08-3.31-4.45-3.62-5.26-.31-.81-.03-1.28.15-1.54.18-.26.4-.34.53-.34h.38c.13 0 .31-.05.48.37.18.43.6 1.48.65 1.59.05.11.08.24.01.38-.07.14-.1.22-.2.34-.1.12-.21.27-.3.36-.1.09-.2.19-.09.37.11.18.49.8 1.05 1.3.72.63 1.33.83 1.51.92.18.09.28.08.38-.05.1-.13.43-.5.55-.67.12-.17.23-.14.39-.08.16.06 1.01.48 1.18.57.18.09.29.13.34.2.05.07.05.4-.29 1.37z"/>
              </svg>
              Share on WhatsApp
            </button>

            <div className="flex gap-2">
              <button
                onClick={onNativeShare}
                className="flex-1 flex items-center justify-center gap-2 bg-gray-100 text-gray-700 px-3 py-3 rounded-xl font-semibold text-sm hover:bg-gray-200 transition-colors"
              >
                More options
              </button>
              <button
                onClick={onCopy}
                className="flex-1 flex items-center justify-center gap-2 bg-gray-100 text-gray-700 px-3 py-3 rounded-xl font-semibold text-sm hover:bg-gray-200 transition-colors"
              >
                {copied ? "Copied!" : "Copy link"}
              </button>
              <button
                onClick={onClose}
                className="px-4 py-3 rounded-xl text-sm font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
