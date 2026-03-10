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
  // Story fields
  howWeMet: string | null;
  proposalStory: string | null;
  coupleMessage: string | null;
  onSaved?: () => void;
}

const DEFAULT_GIFT_ITEMS: Omit<GiftItem, 'id'>[] = [
  { emoji: '🏖️', title: 'Honeymoon Fund', description: 'Help us create unforgettable memories on our honeymoon', amount: 500 },
  { emoji: '🏠', title: 'New Home Fund', description: 'Contribute to our new home together', amount: 1000 },
  { emoji: '🍽️', title: 'Dinner Experience', description: 'Treat us to a special dinner on our honeymoon', amount: 250 },
  { emoji: '✈️', title: 'Flights Contribution', description: 'Help us get to our dream destination', amount: 2000 },
];

export default function WeddingWebsiteSettings({
  coupleId,
  currentTheme,
  giftEnabled,
  giftMessage: initGiftMessage,
  giftItems: initGiftItems,
  weddingWebsiteUrl,
  howWeMet: initHowWeMet,
  proposalStory: initProposalStory,
  coupleMessage: initCoupleMessage,
  onSaved,
}: Props) {
  const [selectedTheme, setSelectedTheme] = useState<ThemeKey>(
    (currentTheme in THEMES ? currentTheme : 'champagne') as ThemeKey
  );
  const [giftOn, setGiftOn] = useState(giftEnabled);
  const [giftMsg, setGiftMsg] = useState(initGiftMessage ?? '');
  const [items, setItems] = useState<GiftItem[]>(initGiftItems.length > 0 ? initGiftItems : []);

  // Story fields
  const [howWeMet, setHowWeMet] = useState(initHowWeMet ?? '');
  const [proposalStory, setProposalStory] = useState(initProposalStory ?? '');
  const [coupleMessage, setCoupleMessage] = useState(initCoupleMessage ?? '');

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<'story' | 'theme' | 'gifts' | 'share'>('story');

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
        body: JSON.stringify({
          weddingTheme: selectedTheme,
          giftEnabled: giftOn,
          giftMessage: giftMsg,
          giftItems: items,
          howWeMet: howWeMet || null,
          proposalStory: proposalStory || null,
          coupleMessage: coupleMessage || null,
        }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
        onSaved?.();
      }
    } finally {
      setSaving(false);
    }
  };

  const addItem = () => {
    const template = DEFAULT_GIFT_ITEMS[items.length % DEFAULT_GIFT_ITEMS.length];
    setItems(prev => [...prev, { ...template, id: Date.now().toString() }]);
  };
  const removeItem = (id: string) => setItems(prev => prev.filter(i => i.id !== id));
  const updateItem = (id: string, field: keyof GiftItem, value: any) =>
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));

  const copyUrl = async () => {
    try { await navigator.clipboard.writeText(weddingWebsiteUrl); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch {}
  };

  const waShare = `https://wa.me/?text=${encodeURIComponent(`View our wedding website 💍\n${weddingWebsiteUrl}`)}`;

  const inp = 'w-full px-3 py-2.5 rounded-xl text-sm border border-gray-200 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all';
  const textarea = `${inp} resize-none`;

  const TABS = [
    { id: 'story' as const,  label: '📖 Story' },
    { id: 'theme' as const,  label: '🎨 Theme' },
    { id: 'gifts' as const,  label: '🎁 Gifts' },
    { id: 'share' as const,  label: '📤 Share' },
  ];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="text-base font-black text-gray-900">Wedding Website</h3>
        <p className="text-xs text-gray-500 mt-0.5">Customise your public wedding page</p>
      </div>

      {/* Inner tabs */}
      <div className="flex border-b border-gray-100 px-1 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-3 text-xs font-semibold whitespace-nowrap transition-colors ${
              tab === t.id
                ? 'text-violet-600 border-b-2 border-violet-500'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-5 space-y-4">

        {/* ── STORY TAB ── */}
        {tab === 'story' && (
          <>
            <p className="text-xs text-gray-500 leading-relaxed">
              Tell your love story — these sections appear on the <strong>Our Story</strong> tab of your wedding website.
            </p>

            {/* How We Met */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2">
                How We Met
              </label>
              <textarea
                value={howWeMet}
                onChange={e => setHowWeMet(e.target.value)}
                rows={4}
                placeholder="Tell your guests the story of how you first met — where you were, what happened, what you felt…"
                className={textarea}
              />
              <p className="text-xs text-gray-400 mt-1">
                {howWeMet.length} characters
              </p>
            </div>

            {/* Proposal Story */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2">
                The Proposal
              </label>
              <textarea
                value={proposalStory}
                onChange={e => setProposalStory(e.target.value)}
                rows={4}
                placeholder="Share the magic of the moment — the setting, the words, the emotions…"
                className={textarea}
              />
              <p className="text-xs text-gray-400 mt-1">
                {proposalStory.length} characters
              </p>
            </div>

            {/* Note to guests */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2">
                A Note to Our Guests
              </label>
              <textarea
                value={coupleMessage}
                onChange={e => setCoupleMessage(e.target.value)}
                rows={3}
                placeholder="A personal message to everyone celebrating with you — shown as a beautiful pull quote…"
                className={textarea}
              />
              <p className="text-xs text-gray-400 mt-1">
                {coupleMessage.length} characters
              </p>
            </div>

            {/* Preview link */}
            <a
              href={weddingWebsiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-violet-600 border border-violet-200 hover:bg-violet-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Preview website
            </a>
          </>
        )}

        {/* ── THEME TAB ── */}
        {tab === 'theme' && (
          <>
            <p className="text-xs text-gray-500">Choose a colour palette for your wedding website</p>
            <div className="grid grid-cols-2 gap-3">
              {THEME_KEYS.map((key) => {
                const theme = THEMES[key];
                const isSelected = selectedTheme === key;
                return (
                  <button
                    key={key}
                    onClick={() => setSelectedTheme(key)}
                    className={`relative p-4 rounded-2xl text-left transition-all ${
                      isSelected
                        ? 'ring-2 ring-violet-500 bg-violet-50'
                        : 'border border-gray-200 hover:border-violet-300'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-2xl">{theme.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900 truncate">{theme.name}</p>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <div
                        className="w-6 h-6 rounded-full border border-white shadow-sm"
                        style={{ background: theme.bg }}
                      />
                      <div
                        className="w-6 h-6 rounded-full border border-white shadow-sm"
                        style={{ background: theme.accent }}
                      />
                      <div
                        className="w-6 h-6 rounded-full border border-white shadow-sm"
                        style={{ background: theme.text }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>

            <a
              href={weddingWebsiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-violet-600 border border-violet-200 hover:bg-violet-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
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
                <p className="text-sm font-semibold text-gray-900">Enable Gift Registry</p>
                <p className="text-xs text-gray-500 mt-0.5">Allow guests to contribute financially</p>
              </div>
              <button
                onClick={() => setGiftOn(!giftOn)}
                className={`relative w-11 h-6 rounded-full transition-colors ${giftOn ? 'bg-violet-500' : 'bg-gray-300'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${giftOn ? 'translate-x-5' : ''}`} />
              </button>
            </div>

            {giftOn && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-2">Gift message</label>
                  <textarea
                    value={giftMsg}
                    onChange={(e) => setGiftMsg(e.target.value)}
                    rows={2}
                    placeholder="Optional: A personal note about your registry"
                    className={textarea}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-xs font-semibold text-gray-700">Gift items</label>
                    <button
                      onClick={addItem}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-violet-500 text-white hover:bg-violet-600"
                    >
                      + Add Item
                    </button>
                  </div>

                  {items.length === 0 && (
                    <div className="text-center py-8 border border-dashed border-gray-300 rounded-xl">
                      <p className="text-sm text-gray-400">No gift items yet</p>
                      <p className="text-xs text-gray-400 mt-1">Click "Add Item" to create one</p>
                    </div>
                  )}

                  <div className="space-y-3">
                    {items.map((item, idx) => (
                      <div key={item.id} className="p-3 border border-gray-200 rounded-xl space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <input
                            value={item.emoji}
                            onChange={(e) => updateItem(item.id, 'emoji', e.target.value)}
                            placeholder="🎁"
                            className="w-12 px-2 py-1.5 text-center rounded-lg text-lg border border-gray-200 outline-none focus:border-violet-400"
                          />
                          <button onClick={() => removeItem(item.id)} className="text-gray-400 hover:text-red-500">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                        <input
                          value={item.title}
                          onChange={(e) => updateItem(item.id, 'title', e.target.value)}
                          placeholder="Gift title"
                          className={inp}
                        />
                        <textarea
                          value={item.description}
                          onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                          rows={2}
                          placeholder="Short description"
                          className={textarea}
                        />
                        <input
                          type="number"
                          value={item.amount}
                          onChange={(e) => updateItem(item.id, 'amount', parseFloat(e.target.value) || 0)}
                          placeholder="Amount (R)"
                          className={inp}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* ── SHARE TAB ── */}
        {tab === 'share' && (
          <>
            <p className="text-xs text-gray-500">Share your wedding website with friends & family</p>

            <div className="flex gap-2">
              <div className="flex-1 px-3 py-2.5 rounded-xl bg-gray-100 text-xs text-gray-600 font-mono overflow-hidden text-ellipsis whitespace-nowrap">
                {weddingWebsiteUrl}
              </div>
              <button
                onClick={copyUrl}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  copied ? 'bg-green-500 text-white' : 'bg-violet-500 text-white hover:bg-violet-600'
                }`}
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <a href={waShare} target="_blank" rel="noopener" className="flex flex-col items-center gap-2 py-4 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
                <div className="w-10 h-10 rounded-full bg-green-500 text-white flex items-center justify-center text-lg">💬</div>
                <span className="text-xs font-semibold text-gray-700">WhatsApp</span>
              </a>
              <a href={`sms:?body=${encodeURIComponent(`View our wedding website 💍\n${weddingWebsiteUrl}`)}`} className="flex flex-col items-center gap-2 py-4 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
                <div className="w-10 h-10 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center text-lg">💌</div>
                <span className="text-xs font-semibold text-gray-700">SMS</span>
              </a>
              <a href={`mailto:?subject=${encodeURIComponent("Our Wedding")}&body=${encodeURIComponent(`View our wedding website 💍\n${weddingWebsiteUrl}`)}`} className="flex flex-col items-center gap-2 py-4 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
                <div className="w-10 h-10 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center text-lg">✉️</div>
                <span className="text-xs font-semibold text-gray-700">Email</span>
              </a>
            </div>

            <a href={weddingWebsiteUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-3 rounded-xl border border-violet-200 text-violet-600 text-sm font-semibold hover:bg-violet-50 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              View your wedding website
            </a>
          </>
        )}

        {/* Save button — not on share tab */}
        {tab !== 'share' && (
          <button
            onClick={save}
            disabled={saving}
            className="w-full py-3.5 rounded-2xl text-sm font-bold transition-all disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)', color: 'white', boxShadow: '0 4px 14px rgba(124,58,237,0.3)' }}
          >
            {saving ? 'Saving…' : saved ? '✅ Saved!' : 'Save Changes'}
          </button>
        )}

      </div>
    </div>
  );
}
