 'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

type Toast = { id: string; message: string; tone?: 'default' | 'success' | 'error' };

const ToastContext = createContext<{ show: (m: string, tone?: Toast['tone']) => void } | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string, tone: Toast['tone'] = 'default') => {
    const id = String(Date.now()) + Math.random().toString(16).slice(2, 8);
    setToasts(t => [...t, { id, message, tone }]);
    return id;
  }, []);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timers: number[] = [];
    toasts.forEach((t, i) => {
      const id = window.setTimeout(() => {
        setToasts(curr => curr.filter(x => x.id !== t.id));
      }, 4000 + i * 250);
      timers.push(id);
    });
    return () => timers.forEach(clearTimeout);
  }, [toasts]);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div aria-live="polite" className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
        {toasts.map(t => (
          <div key={t.id} className={`max-w-sm rounded-lg px-4 py-2 shadow-lg text-sm text-white ${t.tone === 'success' ? 'bg-green-600' : t.tone === 'error' ? 'bg-red-600' : 'bg-gray-800'}`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};
