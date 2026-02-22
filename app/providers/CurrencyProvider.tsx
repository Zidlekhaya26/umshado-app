"use client";
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Currency, ExchangeRates, formatPrice } from '../../../lib/currency';

type CurrencyContext = {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  rates?: ExchangeRates;
  format: (amountInZar: number) => string;
};

const ctx = createContext<CurrencyContext | null>(null);

export const CurrencyProvider = ({ children }: { children: React.ReactNode }) => {
  const [currency, setCurrencyState] = useState<Currency>('ZAR');
  const [rates, setRates] = useState<ExchangeRates | undefined>(undefined);

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem('um_currency') : null;
    if (saved && (saved === 'ZAR' || saved === 'USD' || saved === 'ZWL')) setCurrencyState(saved as Currency);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') window.localStorage.setItem('um_currency', currency);
  }, [currency]);

  const setCurrency = (c: Currency) => setCurrencyState(c);

  const format = (amountInZar: number) => formatPrice(amountInZar, currency, rates);

  return <ctx.Provider value={{ currency, setCurrency, rates, format }}>{children}</ctx.Provider>;
};

export function useCurrency() {
  const c = useContext(ctx);
  if (!c) throw new Error('useCurrency must be used within CurrencyProvider');
  return c;
}
