'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { CR, CR2, CRX, GD, DK, MUT, BOR, BG } from '@/lib/tokens';

/* ─── Limits ─────────────────────────────────────────────── */
const HEADLINE_LIMIT = 60;   // ~8–10 words
const BODY_LIMIT     = 120;  // ~15–20 words
const CTA_LIMIT      = 24;   // ~3 words

/* ─── Category colours (matches marketplace) ─────────────── */
const CAT_COLOR: Record<string, string> = {
  'Photography & Video':           '#3a7bec',
  'Planning & Coordination':       '#14b8a6',
  'Wedding Venues':                '#10b981',
  'Makeup & Hair':                 '#ec4899',
  'Catering & Food':               '#e8523a',
  'Music, DJ & Sound':             '#f59e0b',
  'Décor & Styling':               '#c45ec4',
  'Attire & Fashion':              '#8b5cf6',
  'Support Services':              '#6366f1',
  'Honeymoon & Travel':            '#06b6d4',
  'Transport':                     '#3b82f6',
  'Furniture & Equipment Hire':    '#84cc16',
  'Special Effects & Experiences': '#f97316',
};

type Suggestions = { headlines: string[]; bodies: string[]; ctas: string[] };
type BoostRow = {
  id: string; status: string; ad_headline: string | null;
  ad_body: string | null; ad_cta: string | null;
  ad_image_url: string | null; discount_pct: number | null;
  ends_at: string | null;
};

function wordCount(s: string) {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function CharCount({ val, limit }: { val: string; limit: number }) {
  const over = val.length > limit;
  return (
    <span style={{ fontSize: 10.5, fontWeight: 600, color: over ? CR : '#9ca3af', float: 'right' }}>
      {val.length}/{limit}
    </span>
  );
}

export default function VendorBoostPage() {
  const router = useRouter();

  const [vendorId, setVendorId]         = useState<string | null>(null);
  const [category, setCategory]         = useState('');
  const [portfolio, setPortfolio]       = useState<string[]>([]);
  const [subscription, setSubscription] = useState<string | null>(null);
  const [loading, setLoading]           = useState(true);
  const [existingBoost, setExistingBoost] = useState<BoostRow | null>(null);

  // Form state
  const [headline, setHeadline]   = useState('');
  const [body, setBody]           = useState('');
  const [cta, setCta]             = useState('View Profile');
  const [imageUrl, setImageUrl]   = useState<string | null>(null);
  const [discountPct, setDiscountPct] = useState('');

  // AMi state
  const [amiLoading, setAmiLoading]   = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestions | null>(null);
  const [amiError, setAmiError]       = useState('');

  // Save state
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/auth/login'); return; }

      const { data: v } = await supabase
        .from('vendors')
        .select('id, category, portfolio_urls, subscription_tier')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (v) {
        setVendorId(v.id);
        setCategory(v.category ?? '');
        setPortfolio(v.portfolio_urls ?? []);
        setSubscription(v.subscription_tier ?? null);

        // Load existing active/draft boost
        const { data: boost } = await supabase
          .from('vendor_boosts')
          .select('id, status, ad_headline, ad_body, ad_cta, ad_image_url, discount_pct, ends_at')
          .eq('vendor_id', v.id)
          .in('status', ['active', 'draft'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (boost) {
          setExistingBoost(boost);
          setHeadline(boost.ad_headline ?? '');
          setBody(boost.ad_body ?? '');
          setCta(boost.ad_cta ?? 'View Profile');
          setImageUrl(boost.ad_image_url ?? null);
          setDiscountPct(boost.discount_pct ? String(boost.discount_pct) : '');
        }
      }
      setLoading(false);
    })();
  }, []);

  const isPro = subscription === 'pro' || subscription === 'trial';
  const catColor = CAT_COLOR[category] ?? CR;
  const effectiveImage = imageUrl ?? (portfolio.length > 0 ? portfolio[0] : null);
  const discountNum = discountPct ? parseInt(discountPct, 10) : null;

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? '';
  };

  const askAmi = useCallback(async () => {
    setAmiLoading(true);
    setAmiError('');
    setSuggestions(null);
    try {
      const token = await getToken();
      const res = await fetch('/api/vendor/ami-ad', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
      });
      const j = await res.json();
      if (j.suggestions) setSuggestions(j.suggestions);
      else setAmiError(j.error ?? 'Could not generate suggestions');
    } catch {
      setAmiError('Network error — please try again');
    } finally {
      setAmiLoading(false);
    }
  }, []);

  const handleSave = async (activate = false) => {
    if (!vendorId) return;
    setSaving(true);
    setSaved(false);

    const payload = {
      vendor_id: vendorId,
      ad_headline: headline.trim() || null,
      ad_body: body.trim() || null,
      ad_cta: cta.trim() || 'View Profile',
      ad_image_url: effectiveImage ?? null,
      discount_pct: discountNum ?? null,
      status: activate ? 'active' : 'draft',
      amount_cents: activate ? 19900 : 0,
      ...(activate ? {
        started_at: new Date().toISOString(),
        ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      } : {}),
    };

    if (existingBoost) {
      await supabase.from('vendor_boosts').update(payload).eq('id', existingBoost.id);
    } else {
      const { data } = await supabase.from('vendor_boosts').insert(payload).select('id, status, ad_headline, ad_body, ad_cta, ad_image_url, discount_pct, ends_at').single();
      if (data) setExistingBoost(data);
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  if (loading) return (
    <div style={{ minHeight: '100svh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, border: `3px solid ${BOR}`, borderTopColor: CR, borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  const isActive = existingBoost?.status === 'active';
  const endsAt = existingBoost?.ends_at ? new Date(existingBoost.ends_at) : null;
  const daysLeft = endsAt ? Math.max(0, Math.ceil((endsAt.getTime() - Date.now()) / 86400000)) : null;

  return (
    <div style={{ minHeight: '100svh', background: BG, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}} .ami-chip:hover{opacity:.85} .sug-btn:hover{border-color:${CR}!important;background:rgba(154,33,67,0.04)!important}`}</style>

      {/* Header */}
      <div style={{ background: `linear-gradient(160deg, ${CRX} 0%, ${CR} 52%, #c03050 100%)`, padding: '22px 20px 26px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,transparent,${GD},transparent)` }} />
        <div style={{ position: 'relative' }}>
          <p style={{ margin: '0 0 2px', fontSize: 10, color: 'rgba(255,255,255,0.45)', letterSpacing: 1.3, textTransform: 'uppercase', fontWeight: 700 }}>Vendor Studio</p>
          <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 800, color: '#fff', fontFamily: 'Georgia,serif' }}>Sponsored Boost Ad</h1>
          <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>Build a custom ad with your own copy — R199/month</p>
        </div>
      </div>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '16px 16px 40px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Link href="/vendor/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: MUT, textDecoration: 'none', padding: '6px 12px', borderRadius: 20, background: 'rgba(122,80,96,0.07)', border: `1px solid ${BOR}` }}>
          &larr; Back to dashboard
        </Link>

        {/* Status banner */}
        {isActive && daysLeft !== null && (
          <div style={{ background: 'linear-gradient(135deg,#1e4a30,#2d7a4f)', borderRadius: 14, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 800, color: '#fff' }}>Boost is live</p>
              <p style={{ margin: 0, fontSize: 11.5, color: 'rgba(255,255,255,0.6)' }}>{daysLeft} day{daysLeft !== 1 ? 's' : ''} remaining</p>
            </div>
            <span style={{ fontSize: 10, fontWeight: 800, padding: '4px 10px', borderRadius: 20, background: 'rgba(30,180,90,0.2)', color: '#7effa8', border: '1px solid rgba(30,180,90,0.3)', letterSpacing: 0.5 }}>ACTIVE</span>
          </div>
        )}

        {!isPro && (
          <div style={{ background: 'rgba(154,33,67,0.06)', border: `1.5px solid ${CR}30`, borderRadius: 16, padding: '20px', textAlign: 'center' }}>
            <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 800, color: DK, fontFamily: 'Georgia,serif' }}>Pro required</p>
            <p style={{ margin: '0 0 14px', fontSize: 13, color: MUT }}>Upgrade to Pro to create sponsored boost ads.</p>
            <Link href="/vendor/billing" style={{ display: 'inline-flex', padding: '10px 22px', borderRadius: 12, background: `linear-gradient(135deg,${CR2},${CR})`, color: '#fff', fontSize: 13, fontWeight: 800, textDecoration: 'none' }}>
              Upgrade to Pro
            </Link>
          </div>
        )}

        {/* ── AMi Assistant ── */}
        <div style={{ background: '#fff', borderRadius: 16, border: `1.5px solid ${BOR}`, overflow: 'hidden' }}>
          <div style={{ padding: '16px 18px 14px', borderBottom: `1px solid ${BOR}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg,${CR2},${CR})`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="16" height="16" fill="none" stroke="#fff" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>
              </div>
              <div>
                <p style={{ margin: '0 0 1px', fontSize: 13, fontWeight: 800, color: DK }}>AMi — AI Ad Writer</p>
                <p style={{ margin: 0, fontSize: 11.5, color: MUT }}>Get headline, body & CTA suggestions based on your profile</p>
              </div>
            </div>
            <button
              onClick={askAmi}
              disabled={!isPro || amiLoading}
              className="ami-chip"
              style={{ flexShrink: 0, padding: '9px 16px', borderRadius: 10, border: 'none', background: isPro ? `linear-gradient(135deg,${CR2},${CR})` : '#e5e7eb', color: isPro ? '#fff' : '#9ca3af', fontSize: 12.5, fontWeight: 800, cursor: isPro ? 'pointer' : 'not-allowed', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6, opacity: amiLoading ? 0.7 : 1 }}
            >
              {amiLoading ? (
                <>
                  <div style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
                  Writing…
                </>
              ) : 'Ask AMi'}
            </button>
          </div>

          {amiError && (
            <p style={{ margin: 0, padding: '12px 18px', fontSize: 12, color: CR, background: 'rgba(154,33,67,0.04)' }}>{amiError}</p>
          )}

          {suggestions && (
            <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Headline suggestions */}
              <div>
                <p style={{ margin: '0 0 8px', fontSize: 10.5, fontWeight: 800, color: MUT, letterSpacing: 0.8, textTransform: 'uppercase' }}>Headline options</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {suggestions.headlines.map((h, i) => (
                    <button key={i} className="sug-btn" onClick={() => setHeadline(h.slice(0, HEADLINE_LIMIT))}
                      style={{ textAlign: 'left', padding: '10px 14px', borderRadius: 10, border: `1.5px solid ${BOR}`, background: '#faf9f7', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: DK, fontFamily: 'inherit', transition: 'border-color .14s, background .14s' }}>
                      {h}
                    </button>
                  ))}
                </div>
              </div>
              {/* Body suggestions */}
              <div>
                <p style={{ margin: '0 0 8px', fontSize: 10.5, fontWeight: 800, color: MUT, letterSpacing: 0.8, textTransform: 'uppercase' }}>Body copy options</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {suggestions.bodies.map((b, i) => (
                    <button key={i} className="sug-btn" onClick={() => setBody(b.slice(0, BODY_LIMIT))}
                      style={{ textAlign: 'left', padding: '10px 14px', borderRadius: 10, border: `1.5px solid ${BOR}`, background: '#faf9f7', cursor: 'pointer', fontSize: 12.5, color: '#4b5563', fontFamily: 'inherit', lineHeight: 1.5, transition: 'border-color .14s, background .14s' }}>
                      {b}
                    </button>
                  ))}
                </div>
              </div>
              {/* CTA suggestions */}
              <div>
                <p style={{ margin: '0 0 8px', fontSize: 10.5, fontWeight: 800, color: MUT, letterSpacing: 0.8, textTransform: 'uppercase' }}>CTA button</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {suggestions.ctas.map((c, i) => (
                    <button key={i} className="sug-btn" onClick={() => setCta(c.slice(0, CTA_LIMIT))}
                      style={{ padding: '8px 16px', borderRadius: 20, border: `1.5px solid ${BOR}`, background: '#faf9f7', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, color: DK, fontFamily: 'inherit', transition: 'border-color .14s, background .14s' }}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Ad copy form ── */}
        <div style={{ background: '#fff', borderRadius: 16, border: `1.5px solid ${BOR}`, padding: '20px' }}>
          <p style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 800, color: DK, fontFamily: 'Georgia,serif' }}>Ad copy</p>

          {/* Headline */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 10.5, fontWeight: 800, color: MUT, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>
              Headline <CharCount val={headline} limit={HEADLINE_LIMIT} />
            </label>
            <input
              value={headline}
              onChange={e => setHeadline(e.target.value.slice(0, HEADLINE_LIMIT))}
              placeholder="e.g. Award-winning photography across South Africa"
              disabled={!isPro}
              style={{ width: '100%', padding: '12px 14px', borderRadius: 11, border: `1.5px solid ${headline.length >= HEADLINE_LIMIT ? CR : BOR}`, fontSize: 14, color: DK, outline: 'none', background: isPro ? '#fff' : '#f7f5f4', fontFamily: 'inherit', boxSizing: 'border-box' }}
            />
            <p style={{ margin: '4px 0 0', fontSize: 10.5, color: '#9ca3af' }}>Aim for 6–10 words. This is the main hook.</p>
          </div>

          {/* Body */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 10.5, fontWeight: 800, color: MUT, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>
              Body copy <CharCount val={body} limit={BODY_LIMIT} />
            </label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value.slice(0, BODY_LIMIT))}
              placeholder="e.g. Over 200 weddings captured across SA. Packages from R8 500 including full day coverage."
              disabled={!isPro}
              rows={3}
              style={{ width: '100%', padding: '12px 14px', borderRadius: 11, border: `1.5px solid ${body.length >= BODY_LIMIT ? CR : BOR}`, fontSize: 13, color: DK, outline: 'none', background: isPro ? '#fff' : '#f7f5f4', fontFamily: 'inherit', resize: 'none', boxSizing: 'border-box', lineHeight: 1.5 }}
            />
            <p style={{ margin: '4px 0 0', fontSize: 10.5, color: '#9ca3af' }}>Max {BODY_LIMIT} characters (~15–20 words). Be specific and credible.</p>
          </div>

          {/* CTA */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 10.5, fontWeight: 800, color: MUT, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>
              Button text <CharCount val={cta} limit={CTA_LIMIT} />
            </label>
            <input
              value={cta}
              onChange={e => setCta(e.target.value.slice(0, CTA_LIMIT))}
              placeholder="e.g. View Portfolio"
              disabled={!isPro}
              style={{ width: '100%', padding: '12px 14px', borderRadius: 11, border: `1.5px solid ${cta.length >= CTA_LIMIT ? CR : BOR}`, fontSize: 14, color: DK, outline: 'none', background: isPro ? '#fff' : '#f7f5f4', fontFamily: 'inherit', boxSizing: 'border-box' }}
            />
          </div>

          {/* Discount % */}
          <div>
            <label style={{ display: 'block', fontSize: 10.5, fontWeight: 800, color: MUT, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>
              Discount badge (optional)
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="number" min={0} max={80}
                value={discountPct}
                onChange={e => setDiscountPct(e.target.value)}
                placeholder="e.g. 20"
                disabled={!isPro}
                style={{ width: 90, padding: '11px 14px', borderRadius: 11, border: `1.5px solid ${BOR}`, fontSize: 16, fontWeight: 800, color: DK, outline: 'none', background: isPro ? '#fff' : '#f7f5f4', fontFamily: 'inherit', textAlign: 'center', boxSizing: 'border-box' }}
              />
              <span style={{ fontSize: 18, fontWeight: 800, color: DK }}>%</span>
              {discountNum != null && discountNum > 0 && (
                <span style={{ padding: '5px 13px', borderRadius: 20, background: '#16a34a', color: '#fff', fontSize: 12, fontWeight: 800 }}>
                  {discountNum}% OFF
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Image: pick from portfolio ── */}
        <div style={{ background: '#fff', borderRadius: 16, border: `1.5px solid ${BOR}`, padding: '20px' }}>
          <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 800, color: DK, fontFamily: 'Georgia,serif' }}>Ad image</p>
          <p style={{ margin: '0 0 14px', fontSize: 12, color: MUT }}>
            Pick a photo from your portfolio — first image used as default.
            {portfolio.length === 0 && ' Add portfolio photos in Media & Contact.'}
          </p>
          {portfolio.length === 0 ? (
            <Link href="/vendor/media" style={{ display: 'inline-flex', padding: '9px 16px', borderRadius: 11, background: 'rgba(154,33,67,0.07)', border: `1.5px solid ${CR}30`, color: CR, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
              Go to Media &amp; Contact
            </Link>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(100px,1fr))', gap: 8 }}>
              {portfolio.map((url, i) => {
                const active = (imageUrl ?? portfolio[0]) === url;
                return (
                  <button key={i} type="button" disabled={!isPro} onClick={() => setImageUrl(url)}
                    style={{ padding: 0, border: `2.5px solid ${active ? CR : 'transparent'}`, borderRadius: 12, overflow: 'hidden', cursor: isPro ? 'pointer' : 'default', position: 'relative', aspectRatio: '1', background: '#f0ede8', boxShadow: active ? `0 0 0 3px rgba(154,33,67,0.18)` : 'none' }}>
                    <Image src={url} alt={`Portfolio ${i + 1}`} fill style={{ objectFit: 'cover' }} sizes="110px" />
                    {active && (
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(154,33,67,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ width: 22, height: 22, borderRadius: '50%', background: CR, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="11" height="11" fill="none" stroke="#fff" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Live Preview ── */}
        {(headline || body || effectiveImage) && (
          <div style={{ background: '#fff', borderRadius: 16, border: `1.5px solid ${BOR}`, padding: '18px' }}>
            <p style={{ margin: '0 0 12px', fontSize: 10.5, fontWeight: 800, color: MUT, letterSpacing: 0.8, textTransform: 'uppercase' }}>Live preview</p>
            <div style={{ borderRadius: 16, overflow: 'hidden', background: `${catColor}0c`, border: `1.5px solid ${catColor}22`, display: 'flex', minHeight: 140, position: 'relative' }}>
              {/* SPONSORED badge */}
              <div style={{ position: 'absolute', top: 10, right: effectiveImage ? 'calc(38% + 8px)' : 10, display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 20, background: 'rgba(255,255,255,0.92)', border: '1px solid rgba(0,0,0,0.07)', zIndex: 2 }}>
                <svg width="7" height="7" viewBox="0 0 24 24" fill="#f59e0b"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                <span style={{ fontSize: 9, fontWeight: 700, color: '#6b7280', letterSpacing: 0.4 }}>SPONSORED</span>
              </div>
              {/* Left content */}
              <div style={{ flex: 1, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'center', minWidth: 0 }}>
                <span style={{ fontSize: 9.5, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: `${catColor}18`, color: catColor, border: `1px solid ${catColor}25`, alignSelf: 'flex-start' }}>
                  {category.split('&')[0].trim() || 'Category'}
                </span>
                {headline && <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#111827', fontFamily: 'Georgia,serif', lineHeight: 1.25 }}>{headline}</h3>}
                {body && <p style={{ margin: 0, fontSize: 11.5, color: '#6b7280', lineHeight: 1.45 }}>{body}</p>}
                {cta && (
                  <div style={{ alignSelf: 'flex-start', marginTop: 4, padding: '7px 16px', borderRadius: 20, background: catColor, color: '#fff', fontSize: 11, fontWeight: 800, letterSpacing: 0.3 }}>
                    {cta.toUpperCase()}
                  </div>
                )}
              </div>
              {/* Right: image */}
              {effectiveImage && (
                <div style={{ width: '38%', flexShrink: 0, position: 'relative' }}>
                  <Image src={effectiveImage} alt="Ad preview" fill style={{ objectFit: 'cover' }} sizes="200px" />
                  {discountNum != null && discountNum > 0 && (
                    <div style={{ position: 'absolute', bottom: 10, left: 10, background: '#16a34a', color: '#fff', fontSize: 11, fontWeight: 800, padding: '4px 11px', borderRadius: 20 }}>
                      {discountNum}% OFF
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Actions ── */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => handleSave(false)} disabled={!isPro || saving}
            style={{ flex: 1, padding: '13px', borderRadius: 13, border: `1.5px solid ${BOR}`, background: '#fff', color: isPro ? DK : '#9ca3af', fontSize: 14, fontWeight: 700, cursor: isPro ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
            {saving ? 'Saving…' : 'Save draft'}
          </button>
          <button onClick={() => handleSave(true)} disabled={!isPro || saving}
            style={{ flex: 2, padding: '13px', borderRadius: 13, border: 'none', background: isPro ? `linear-gradient(135deg,${CR2},${CR})` : '#d1d5db', color: '#fff', fontSize: 14, fontWeight: 800, cursor: isPro ? 'pointer' : 'not-allowed', fontFamily: 'inherit', boxShadow: isPro ? '0 4px 18px rgba(154,33,67,0.28)' : 'none', opacity: saving ? 0.7 : 1 }}>
            {isActive ? 'Update live ad' : 'Activate — R199/mo'}
          </button>
        </div>
        {saved && (
          <p style={{ textAlign: 'center', fontSize: 12, color: '#16a34a', fontWeight: 600, margin: 0 }}>
            {isActive ? 'Ad updated and live in the marketplace.' : 'Draft saved. Activate when ready.'}
          </p>
        )}

        <p style={{ margin: 0, textAlign: 'center', fontSize: 11, color: '#9ca3af', lineHeight: 1.5 }}>
          Boost runs for 30 days. Your ad appears in the marketplace sponsored carousel above vendor listings. Cancel anytime from Billing.
        </p>
      </div>
    </div>
  );
}
