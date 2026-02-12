"use client";

import React, { useEffect } from "react";

type Props = {
  src: string | null | undefined;
  alt?: string;
  isOpen: boolean;
  onClose: () => void;
};

export default function ImageLightbox({ src, alt = "Image", isOpen, onClose }: Props) {
  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !src) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-800">{alt}</p>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 active:bg-gray-200 transition"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="p-6 bg-[#FAF6F6] flex items-center justify-center">
          <img
            src={src}
            alt={alt}
            className="max-h-[60vh] w-auto max-w-full object-contain"
          />
        </div>

        <div className="px-4 pb-4">
          <a
            href={src}
            target="_blank"
            rel="noreferrer"
            className="inline-flex text-sm font-semibold text-[#7A1E3A] hover:underline"
          >
            Open in new tab
          </a>
        </div>
      </div>
    </div>
  );
}
