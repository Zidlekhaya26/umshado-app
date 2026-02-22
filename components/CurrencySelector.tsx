"use client";
import React from 'react';
import { useCurrency } from '../app/providers/CurrencyProvider';

export default function CurrencySelector() {
  const { currency, setCurrency } = useCurrency();
  return (
    <div className="flex items-center gap-2">
      <label className="text-sm text-gray-600">Currency</label>
      <select
        value={currency}
        onChange={(e) => setCurrency(e.target.value as any)}
        className="border rounded px-2 py-1 text-sm"
      >
        <option value="ZAR">R (ZAR)</option>
        <option value="USD">$ (USD)</option>
        <option value="BWP">P (BWP)</option>
      </select>
    </div>
  );
}
