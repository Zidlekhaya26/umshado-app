"use client";

import { useState } from "react";
import { SharePayload, shareLink } from "../../lib/share";

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

  // Removed WhatsApp share option per UX request (was distorting mobile layout)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4">
      <div className="w-full max-w-md rounded-t-lg bg-white p-4 shadow-lg">
        <div className="mb-2 text-lg font-semibold">Share profile</div>
        <div className="flex flex-col gap-2">
          <button
            className="w-full rounded bg-sky-600 px-3 py-2 text-white"
            onClick={async () => {
              const res = await shareLink(payload);
              if (res.ok && res.usedNative) onClose();
            }}
          >
            Use device share
          </button>
        </div>
        <div className="mt-3 flex gap-2">
          <button className="rounded border px-3 py-2" onClick={onCopy}>
            {copied ? "Copied!" : "Copy link"}
          </button>
          <button className="rounded border px-3 py-2" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
