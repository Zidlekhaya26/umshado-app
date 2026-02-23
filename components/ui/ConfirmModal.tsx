'use client';

import React from 'react';

export default function ConfirmModal({ open, title, message, onConfirm, onClose, confirmLabel = 'Confirm', cancelLabel = 'Cancel' }: {
  open: boolean;
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 z-10">
        {title && <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>}
        {message && <p className="text-sm text-gray-600 mb-4">{message}</p>}
        <div className="flex gap-3 mt-4">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition-colors">{cancelLabel}</button>
          <button onClick={onConfirm} className="flex-1 px-4 py-2.5 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 transition-colors">{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
