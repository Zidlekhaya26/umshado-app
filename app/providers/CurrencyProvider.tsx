"use client";
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Currency, ExchangeRates, formatPrice } from '../../lib/currency';

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

  const format = (amountInZar: number) => formatPrice(amountInZar, currency, rates);

  // helper to fetch and set rates
  const fetchRates = async () => {
    try {
      const res = await fetch('/api/exchange-rates');
      if (!res.ok) return;
      const json = await res.json();
      if (json?.rates) setRates(json.rates as ExchangeRates);
    } catch (e) {
      // ignore failures - formatting will fall back to no rates
    }
  };

  // Fetch live exchange rates on mount
  useEffect(() => { fetchRates(); }, []);

  // When currency is changed away from ZAR, ensure we have rates available
  const setCurrency = (c: Currency) => {
    setCurrencyState(c);
    if (c !== 'ZAR' && !rates) {
      // fire-and-forget fetch to obtain rates so formatting will convert
      fetchRates();
    }
  };

  return <ctx.Provider value={{ currency, setCurrency, rates, format }}>{children}</ctx.Provider>;
};

export function useCurrency() {
  const c = useContext(ctx);
  if (!c) throw new Error('useCurrency must be used within CurrencyProvider');
  return c;
}
