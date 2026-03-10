'use client';

import { useState } from 'react';
import { THEMES, ThemeKey } from '@/app/w/[coupleId]/WeddingWebsite';
import { supabase } from '@/lib/supabaseClient';

const THEME_KEYS = Object.keys(THEMES) as ThemeKey[];

interface GiftItem {
  id: string;
  title: string;
  description: string;
  amount: number;
  emoji: string;
}

interface Props {
  coupleId: string;
  currentTheme: string;
  giftEnabled: boolean;
  giftMessage: string | null;
  giftItems: GiftItem[];
  weddingWebsiteUrl: string;
  onSaved?: () => void;
}

const DEFAULT_GIFT_ITEMS: Omit<GiftItem, 'id'>[] = [
  { emoji: '🏖️', title: 'Honeymoon Fund', description: 'Help us create unforgettable memories on our honeymoon', amount: 500 },
  { emoji: '🏠', title: 'New Home Fund', description: 'Contribute to our new home together', amount: 1000 },
  { emoji: '🍽️', title: 'Dinner Experience', description: 'Treat us to a special dinner on our honeymoon', amount: 250 },
  { emoji: '✈️', title: 'Flights Contribution', description: 'Help us get to our dream destination', amount: 2000 },
];

export default function WeddingWebsiteSettings({ coupleId, currentTheme, giftEnabled, giftMessage: initGiftMessage, giftItems: initGiftItems, weddingWebsiteUrl, onSaved }: Props) {
  const [selectedTheme, setSelectedTheme] = useState<ThemeKey>((currentTheme in THEMES ? currentTheme : 'champagne') as ThemeKey);
  const [giftOn, setGiftOn] = useState(giftEnabled);
  const [giftMsg, setGiftMsg] = useState(initGiftMessage ?? '');
  const [items, setItems] = useState<GiftItem[]>(initGiftItems.length > 0 ? initGiftItems : []);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<'theme' | 'gifts' | 'share'>('theme');

  const save = async () => {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/couple/website-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ weddingTheme: selectedTheme, giftEnabled: giftOn, giftMessage: giftMsg, giftItems: items }),
      });
      if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2500); onSaved?.(); }
    } finally { setSaving(false); }
  };

  const addItem = () => {
    const template = DEFAULT_GIFT_ITEMS[items.length % DEFAULT_GIFT_ITEMS.length];
    setItems(prev => [...prev, { ...template, id: Date.now().toString() }]);
  };

  const removeItem = (id: string) => setItems(prev => prev.filter(i => i.id !== id));
  const updateItem = (id: string, field: keyof GiftItem, value: any) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const copyUrl = async () => {
    try { await navigator.clipboard.writeText(weddingWebsiteUrl); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch {}
  };

  const waShare = `https://wa.me/?text=${encodeURIComponent(`View our wedding website 💍\n${weddingWebsiteUrl}`)}`;

  const inp = 'w-full px-3 py-2.5 rounded-xl text-sm border border-gray-200 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all';

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="text-base font-black text-gray-900">Wedding Website</h3>
        <p className="text-xs text-gray-500 mt-0.5">Customise your public wedding page</p>
      </div>

      {/* Inner tabs */}
      <div className="flex border-b border-gray-100 px-2">
        {(['theme', 'gifts', 'share'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-3 text-xs font-semibold capitalize transition-colors ${tab === t ? 'text-violet-600 border-b-2 border-violet-500' : 'text-gray-400'}`}>
            {t === 'theme' ? '🎨 Theme' : t === 'gifts' ? '🎁 Gifts' : '📤 Share'}
          </button>
        ))}
      </div>

      <div className="p-5 space-y-4">

        {/* ── THEME TAB ── */}
        {tab === 'theme' && (
          <>
            <p className="text-xs text-gray-500">Choose a colour palette for your wedding website</p>
            <div className="grid grid-cols-2 gap-3">
              {THEME_KEYS.map(key => {
                const theme = THEMES[key];
                const isLight = key === 'ivory';
                return (
                  <button
                    key={key}
                    onClick={() => setSelectedTheme(key)}
                    className={`p-4 rounded-xl border-2 transition-all text-left ${selectedTheme === key ? 'border-violet-500 shadow-lg' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">{theme.emoji}</span>
                      <div className="flex-1">
                        <p className="text-xs font-bold text-gray-900">{theme.name}</p>
                      </div>
                      {selectedTheme === key && (
                        <svg className="w-4 h-4 text-violet-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                        </svg>
                      )}
                    </div>
                    <div className="flex gap-1.5">
                      <div className="w-8 h-8 rounded-lg" style={{ background: theme.bg }}/>
                      <div className="w-8 h-8 rounded-lg" style={{ background: theme.accent }}/>
                      <div className="w-8 h-8 rounded-lg border border-gray-200" style={{ background: theme.text, color: isLight ? '#000' : '#fff' }}/>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Live preview link */}
            <a href={weddingWebsiteUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-violet-600 border border-violet-200 hover:bg-violet-50 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
              </svg>
              Preview website
            </a>
          </>
        )}

        {/* ── GIFTS TAB ── */}
        {tab === 'gifts' && (
          <>
            {/* Toggle */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <div>
                <p className="text-sm font-bold text-gray-900">Enable Gift Registry</p>
                <p className="text-xs text-gray-500">Show a gift tab on your wedding website</p>
              </div>
              <button onClick={() => setGiftOn(p => !p)}
                className={`w-12 h-6 rounded-full transition-colors relative ${giftOn ? 'bg-violet-500' : 'bg-gray-300'}`}>
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${giftOn ? 'translate-x-7' : 'translate-x-1'}`}/>
              </button>
            </div>

            {giftOn && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Gift Message</label>
                  <textarea value={giftMsg} onChange={e => setGiftMsg(e.target.value)} rows={2} placeholder="e.g. Your presence is the greatest gift. If you'd like to contribute to our honeymoon…"
                    className={`${inp} resize-none`}/>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-gray-700">Gift Items</label>
                    <button onClick={addItem}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold text-violet-600 bg-violet-50 hover:bg-violet-100 transition-colors">
                      + Add Item
                    </button>
                  </div>

                  {items.length === 0 ? (
                    <div className="text-center py-6 bg-gray-50 rounded-xl">
                      <p className="text-2xl mb-2">🎁</p>
                      <p className="text-xs text-gray-500">No gift items yet. Add one to get started.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {items.map((item, idx) => (
                        <div key={item.id} className="p-3 bg-gray-50 rounded-xl space-y-2">
                          <div className="flex gap-2">
                            <input value={item.emoji} onChange={e => updateItem(item.id, 'emoji', e.target.value)} placeholder="🎁" className="w-14 px-2 py-1.5 rounded-lg text-center text-sm border border-gray-200 outline-none focus:border-violet-400"/>
                            <input value={item.title} onChange={e => updateItem(item.id, 'title', e.target.value)} placeholder="Gift title" className={`flex-1 px-2 py-1.5 rounded-lg text-sm border border-gray-200 outline-none focus:border-violet-400`}/>
                            <button onClick={() => removeItem(item.id)} className="w-8 h-8 rounded-lg text-red-600 hover:bg-red-50 transition-colors flex items-center justify-center">
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
                              </svg>
                            </button>
                          </div>
                          <input value={item.description} onChange={e => updateItem(item.id, 'description', e.target.value)} placeholder="Gift description" className={`${inp} text-xs`}/>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-gray-600">Amount:</span>
                            <input type="number" value={item.amount} onChange={e => updateItem(item.id, 'amount', Number(e.target.value))} placeholder="500" className="flex-1 px-2 py-1.5 rounded-lg text-sm border border-gray-200 outline-none focus:border-violet-400"/>
                            <span className="text-xs text-gray-500">ZAR</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {/* ── SHARE TAB ── */}
        {tab === 'share' && (
          <>
            <p className="text-xs text-gray-500">Share your wedding website with friends & family</p>

            {/* URL */}
            <div className="flex gap-2">
              <div className="flex-1 px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-xs text-gray-600 font-mono overflow-hidden text-ellipsis whitespace-nowrap">
                {weddingWebsiteUrl}
              </div>
              <button onClick={copyUrl}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${copied ? 'bg-green-500 text-white' : 'bg-violet-100 text-violet-700 hover:bg-violet-200'}`}>
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>

            {/* Share channels */}
            <div className="grid grid-cols-3 gap-3">
              <a href={waShare} target="_blank" rel="noopener" className="flex flex-col items-center gap-2 py-4 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
                <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white text-lg">💬</div>
                <span className="text-xs font-semibold text-gray-700">WhatsApp</span>
              </a>
              <a href={`sms:?body=${encodeURIComponent(`View our wedding website 💍\n${weddingWebsiteUrl}`)}`} className="flex flex-col items-center gap-2 py-4 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
                <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center text-lg">💬</div>
                <span className="text-xs font-semibold text-gray-700">SMS</span>
              </a>
              <a href={`mailto:?subject=${encodeURIComponent('Our Wedding')}&body=${encodeURIComponent(`View our wedding website 💍\n${weddingWebsiteUrl}`)}`} className="flex flex-col items-center gap-2 py-4 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
                <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center text-lg">✉️</div>
                <span className="text-xs font-semibold text-gray-700">Email</span>
              </a>
            </div>

            {/* Preview */}
            <a href={weddingWebsiteUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-3 rounded-xl border border-violet-200 text-violet-600 text-sm font-semibold hover:bg-violet-50 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
              </svg>
              View your wedding website
            </a>
          </>
        )}

        {/* Save button (not on share tab) */}
        {tab !== 'share' && (
          <button onClick={save} disabled={saving}
            className="w-full py-3.5 rounded-2xl text-sm font-bold transition-all disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)', color: 'white', boxShadow: '0 4px 14px rgba(124,58,237,0.3)' }}>
            {saving ? 'Saving…' : saved ? '✅ Saved!' : 'Save Changes'}
          </button>
        )}
      </div>
    </div>
  );
}
