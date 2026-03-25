'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { CR, CR2, CRX, GD, DK, MUT, BOR, BG } from '@/lib/tokens';

type VendorRow = {
  id: string;
  subscription_tier: string | null;
  promo_image_url: string | null;
  promo_discount_pct: number | null;
  portfolio_urls: string[] | null;
};

export default function VendorPromoPage() {
  const router = useRouter();
  const [vendor, setVendor] = useState<VendorRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [discountPct, setDiscountPct] = useState<number | null>(null);
  const [discountInput, setDiscountInput] = useState('');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/auth/login'); return; }

      const { data } = await supabase
        .from('vendors')
        .select('id, subscription_tier, promo_image_url, promo_discount_pct, portfolio_urls')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setVendor(data);
        setSelectedImage(data.promo_image_url ?? null);
        setDiscountPct(data.promo_discount_pct ?? null);
        setDiscountInput(data.promo_discount_pct ? String(data.promo_discount_pct) : '');
      }
      setLoading(false);
    })();
  }, []);

  const portfolio = vendor?.portfolio_urls ?? [];
  const isPro = vendor?.subscription_tier === 'pro' || vendor?.subscription_tier === 'trial';

  // Fallback: if no promo image selected yet but portfolio has images, default to first portfolio image
  const effectiveImage = selectedImage ?? (portfolio.length > 0 ? portfolio[0] : null);

  const handleDiscountChange = (val: string) => {
    setDiscountInput(val);
    const n = parseInt(val, 10);
    if (!val) setDiscountPct(null);
    else if (!isNaN(n) && n >= 0 && n <= 80) setDiscountPct(n);
  };

  const handleSave = async () => {
    if (!vendor) return;
    setSaving(true);
    setSaved(false);
    await supabase
      .from('vendors')
      .update({
        promo_image_url: effectiveImage ?? null,
        promo_discount_pct: discountPct ?? null,
      })
      .eq('id', vendor.id);
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

  return (
    <div style={{ minHeight: '100svh', background: BG, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{ background: `linear-gradient(160deg, ${CRX} 0%, ${CR} 52%, #c03050 100%)`, padding: '22px 20px 26px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,transparent,${GD},transparent)`, pointerEvents: 'none' }} />
        <div style={{ position: 'relative' }}>
          <p style={{ margin: '0 0 2px', fontSize: 10, color: 'rgba(255,255,255,0.45)', letterSpacing: 1.3, textTransform: 'uppercase', fontWeight: 700 }}>Vendor Studio</p>
          <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 800, color: '#fff', fontFamily: 'Georgia,serif' }}>Sponsored Promo</h1>
          <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>Set your promo image and discount to appear in the marketplace spotlight</p>
        </div>
      </div>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '16px 16px 40px' }}>
        <Link href="/vendor/profile/edit" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: MUT, textDecoration: 'none', padding: '6px 12px', borderRadius: 20, background: 'rgba(122,80,96,0.07)', border: `1px solid ${BOR}`, marginBottom: 20 }}>
          &larr; Back to profile
        </Link>

        {!isPro && (
          <div style={{ background: 'rgba(154,33,67,0.06)', border: `1.5px solid ${CR}30`, borderRadius: 16, padding: '20px', marginBottom: 20, textAlign: 'center' }}>
            <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 800, color: DK, fontFamily: 'Georgia,serif' }}>Pro feature</p>
            <p style={{ margin: '0 0 14px', fontSize: 13, color: MUT }}>Upgrade to Pro to appear in sponsored ads and set promotional discounts.</p>
            <Link href="/vendor/billing" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 22px', borderRadius: 12, background: `linear-gradient(135deg,${CR2},${CR})`, color: '#fff', fontSize: 13, fontWeight: 800, textDecoration: 'none' }}>
              Upgrade to Pro
            </Link>
          </div>
        )}

        {/* Discount % */}
        <div style={{ background: '#fff', borderRadius: 16, border: `1.5px solid ${BOR}`, padding: '20px', marginBottom: 14 }}>
          <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 800, color: DK }}>Discount percentage</p>
          <p style={{ margin: '0 0 14px', fontSize: 12, color: MUT }}>Show a % OFF badge on your sponsored ad. Leave blank for no badge.</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input
              type="number"
              min={0}
              max={80}
              value={discountInput}
              onChange={e => handleDiscountChange(e.target.value)}
              placeholder="e.g. 20"
              disabled={!isPro}
              style={{ width: 100, padding: '11px 14px', borderRadius: 11, border: `1.5px solid ${BOR}`, fontSize: 18, fontWeight: 800, color: DK, outline: 'none', background: isPro ? '#fff' : '#f7f5f4', fontFamily: 'inherit', textAlign: 'center' }}
            />
            <span style={{ fontSize: 20, fontWeight: 800, color: DK }}>%</span>
            {discountPct != null && (
              <div style={{ padding: '6px 14px', borderRadius: 20, background: '#16a34a', color: '#fff', fontSize: 12, fontWeight: 800 }}>
                {discountPct}% OFF preview
              </div>
            )}
          </div>
          {discountInput && (parseInt(discountInput) > 80 || parseInt(discountInput) < 0) && (
            <p style={{ margin: '8px 0 0', fontSize: 11, color: CR }}>Enter a value between 0 and 80</p>
          )}
        </div>

        {/* Promo image — pick from portfolio */}
        <div style={{ background: '#fff', borderRadius: 16, border: `1.5px solid ${BOR}`, padding: '20px', marginBottom: 14 }}>
          <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 800, color: DK }}>Promo image</p>
          <p style={{ margin: '0 0 16px', fontSize: 12, color: MUT }}>
            Pick a photo from your portfolio to use in sponsored ads.
            {portfolio.length === 0 && ' Add portfolio images in Media & Contact first.'}
          </p>

          {portfolio.length === 0 ? (
            <Link href="/vendor/media" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 18px', borderRadius: 12, background: 'rgba(154,33,67,0.07)', border: `1.5px solid ${CR}30`, color: CR, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
              Go to Media &amp; Contact
            </Link>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(110px,1fr))', gap: 10 }}>
              {portfolio.map((url, i) => {
                const active = (selectedImage ?? (portfolio.length > 0 ? portfolio[0] : null)) === url;
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={!isPro}
                    onClick={() => setSelectedImage(url)}
                    style={{
                      padding: 0, border: `2.5px solid ${active ? CR : 'transparent'}`,
                      borderRadius: 12, overflow: 'hidden', cursor: isPro ? 'pointer' : 'default',
                      position: 'relative', aspectRatio: '1', background: '#f0ede8',
                      boxShadow: active ? `0 0 0 3px rgba(154,33,67,0.18)` : 'none',
                    }}
                  >
                    <Image src={url} alt={`Portfolio ${i + 1}`} fill style={{ objectFit: 'cover' }} sizes="120px" />
                    {active && (
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(154,33,67,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ width: 24, height: 24, borderRadius: '50%', background: CR, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="12" height="12" fill="none" stroke="#fff" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Live preview */}
        {(effectiveImage || discountPct) && (
          <div style={{ background: '#fff', borderRadius: 16, border: `1.5px solid ${BOR}`, padding: '20px', marginBottom: 20 }}>
            <p style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 800, color: MUT, letterSpacing: 0.8, textTransform: 'uppercase' }}>Ad preview</p>
            <div style={{ borderRadius: 14, overflow: 'hidden', background: 'rgba(58,123,236,0.06)', border: '1.5px solid rgba(58,123,236,0.18)', display: 'flex', minHeight: 120 }}>
              <div style={{ flex: 1, padding: '14px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 5 }}>
                <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: 'rgba(58,123,236,0.12)', color: '#3a7bec', border: '1px solid rgba(58,123,236,0.2)', alignSelf: 'flex-start' }}>Your category</span>
                <p style={{ margin: 0, fontSize: 10, fontWeight: 800, color: '#3a7bec', letterSpacing: 0.6, textTransform: 'uppercase' }}>Your business name</p>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: DK, fontFamily: 'Georgia,serif', lineHeight: 1.3 }}>Your ad headline</p>
                <div style={{ marginTop: 4, padding: '7px 14px', borderRadius: 20, background: '#3a7bec', color: '#fff', fontSize: 10.5, fontWeight: 800, alignSelf: 'flex-start' }}>VIEW PROFILE</div>
              </div>
              {effectiveImage && (
                <div style={{ width: '38%', flexShrink: 0, position: 'relative' }}>
                  <Image src={effectiveImage} alt="Promo preview" fill style={{ objectFit: 'cover' }} sizes="200px" />
                  {discountPct && (
                    <div style={{ position: 'absolute', bottom: 10, left: 10, background: '#16a34a', color: '#fff', fontSize: 11, fontWeight: 800, padding: '4px 11px', borderRadius: 20 }}>
                      {discountPct}% OFF
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={!isPro || saving}
          style={{ width: '100%', padding: '14px', borderRadius: 14, border: 'none', background: isPro ? `linear-gradient(135deg,${CR2},${CR})` : '#d1d5db', color: '#fff', fontSize: 15, fontWeight: 800, cursor: isPro ? 'pointer' : 'not-allowed', fontFamily: 'inherit', boxShadow: isPro ? '0 4px 18px rgba(154,33,67,0.28)' : 'none', opacity: saving ? 0.7 : 1 }}
        >
          {saving ? 'Saving…' : saved ? 'Saved!' : 'Save promo settings'}
        </button>
        {saved && (
          <p style={{ margin: '10px 0 0', textAlign: 'center', fontSize: 12, color: '#16a34a', fontWeight: 600 }}>Your promo will appear in sponsored ads within minutes.</p>
        )}
      </div>
    </div>
  );
}
