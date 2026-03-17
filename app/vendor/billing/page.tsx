'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import VendorBottomNav from '@/components/VendorBottomNav';
import { LoadingPage } from '@/components/ui/UmshadoLogo';
import { getEffectiveTier, getTrialDaysLeft, type VendorSubscription } from '@/lib/subscription';
import { CR, CR2, CRX, GD, DK, MUT, BOR, BG } from '@/lib/tokens';

function CheckIcon({ color = CR }: { color?: string }) {
  return (
    <svg width="14" height="14" fill="none" stroke={color} strokeWidth={2.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function TrialBanner({ daysLeft }: { daysLeft: number }) {
  const pct = Math.round(((30 - daysLeft) / 30) * 100);
  const urgent = daysLeft <= 7;
  return (
    <div style={{ borderRadius: 16, padding: '16px 18px', background: urgent ? `linear-gradient(135deg,${CRX},${CR})` : 'linear-gradient(135deg,#0f2027,#203a43,#2c5364)', color: '#fff', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: -30, right: -30, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase', color: urgent ? 'rgba(255,255,255,0.7)' : '#BD983F' }}>{urgent ? 'Trial ending soon' : 'Free trial active'}</p>
          <p style={{ margin: '3px 0 0', fontSize: 20, fontWeight: 800, fontFamily: 'Georgia,serif' }}>{daysLeft} {daysLeft === 1 ? 'day' : 'days'} left</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>All features unlocked</p>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>except Verification</p>
        </div>
      </div>
      <div style={{ height: 5, borderRadius: 4, background: 'rgba(255,255,255,0.15)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, borderRadius: 4, background: urgent ? '#fff' : '#BD983F' }} />
      </div>
      <p style={{ margin: '8px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>{pct}% of trial used · Upgrade before it ends to keep all features</p>
    </div>
  );
}

function FreeBanner() {
  return (
    <div style={{ borderRadius: 16, padding: '14px 18px', background: '#f9f5f0', border: `1.5px solid ${BOR}`, display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#e8d5d0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <svg width="18" height="18" fill="none" stroke={MUT} strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
      </div>
      <div>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: DK }}>Free plan</p>
        <p style={{ margin: '2px 0 0', fontSize: 11.5, color: MUT }}>Your trial has ended. Upgrade to Pro to unlock all features.</p>
      </div>
    </div>
  );
}

function ProBanner({ expiresAt }: { expiresAt: string | null }) {
  const exp = expiresAt ? new Date(expiresAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' }) : null;
  return (
    <div style={{ borderRadius: 16, padding: '14px 18px', background: `linear-gradient(135deg,${CRX},${CR})`, display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <svg width="18" height="18" fill="none" stroke="#fff" strokeWidth={2.2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 3l14 9-14 9V3z" /></svg>
      </div>
      <div>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#fff' }}>Pro plan — active</p>
        {exp && <p style={{ margin: '2px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>Renews {exp}</p>}
      </div>
    </div>
  );
}

type BillingVendor = VendorSubscription & { id?: string; business_name?: string | null; email?: string };
type AdCreative = { headline: string; body: string; cta: string };

export default function VendorBilling() {
  const router = useRouter();
  const [loading, setLoading]     = useState(true);
  const [vendor, setVendor]       = useState<BillingVendor | null>(null);
  const [billingCycle, setCycle]  = useState<'monthly' | 'yearly'>('monthly');
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [ad, setAd]               = useState<AdCreative>({ headline: '', body: '', cta: 'View Profile' });
  const [adFocused, setAdFocused] = useState('');
  const [errorMsg, setErrorMsg]   = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/sign-in'); return; }
      const { data } = await supabase
        .from('vendors')
        .select('id,business_name,subscription_tier,subscription_status,trial_started_at,subscription_expires_at,verified,verification_paid_at,verification_status,created_at')
        .eq('user_id', user.id)
        .maybeSingle();
      setVendor(data ? { ...data, email: user.email } : { email: user.email, created_at: user.created_at });
      setLoading(false);
    })();
  }, [router]);

  const initiatePayment = async (type: string) => {
    setSubmitting(type); setErrorMsg(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/vendor/billing/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ type, billingCycle, adCreative: type === 'boost' ? ad : undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Payment failed');
      window.location.href = json.redirectUrl;
    } catch (err: any) {
      setErrorMsg(err.message || 'Something went wrong. Please try again.');
      setSubmitting(null);
    }
  };

  if (loading) return <LoadingPage />;

  const tier               = getEffectiveTier(vendor || {});
  const daysLeft           = getTrialDaysLeft(vendor || {});
  const isPro              = tier === 'pro';
  const isVerified         = vendor?.verified;
  const verificationStatus = vendor?.verification_status;

  const IS = (f: string): React.CSSProperties => ({
    width: '100%', padding: '11px 14px', borderRadius: 10,
    border: `1.5px solid ${adFocused === f ? CR : BOR}`,
    outline: 'none', fontSize: 13, color: DK, background: '#fff',
    fontFamily: 'inherit', boxSizing: 'border-box',
    boxShadow: adFocused === f ? `0 0 0 3px rgba(154,33,67,0.08)` : 'none',
    transition: 'border-color .14s,box-shadow .14s',
  });

  return (
    <div style={{ minHeight: '100svh', background: BG, fontFamily: "'DM Sans',system-ui,sans-serif" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} input,textarea,button{font-family:inherit!important}`}</style>

      {/* Header */}
      <div style={{ background: `linear-gradient(160deg,${CRX} 0%,${CR} 52%,#c03050 100%)`, padding: '20px 20px 24px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 130, height: 130, borderRadius: '50%', border: '1.5px solid rgba(189,152,63,0.1)', pointerEvents: 'none' }} />
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.75)', fontSize: 13, marginBottom: 14 }}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5M12 19l-7-7 7-7" /></svg>
          Back
        </button>
        <h1 style={{ margin: '0 0 3px', fontSize: 22, fontWeight: 800, color: '#fff', fontFamily: 'Georgia,serif' }}>Billing & Plans</h1>
        <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>Manage your subscription and boost your visibility</p>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '20px 16px calc(100px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Status */}
        {tier === 'trial' && <TrialBanner daysLeft={daysLeft} />}
        {tier === 'free'  && <FreeBanner />}
        {tier === 'pro'   && <ProBanner expiresAt={vendor?.subscription_expires_at || null} />}

        {errorMsg && <div style={{ padding: '12px 16px', borderRadius: 12, background: '#fef2f2', border: '1.5px solid #fca5a5', color: '#dc2626', fontSize: 13 }}>{errorMsg}</div>}

        {/* ── Pro upgrade card ───────────────────── */}
        {!isPro && (
          <div style={{ borderRadius: 20, overflow: 'hidden', border: `2px solid ${CR}`, boxShadow: `0 8px 32px rgba(154,33,67,0.14)` }}>
            <div style={{ background: `linear-gradient(135deg,${CRX},${CR})`, padding: '18px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.2, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase' }}>Upgrade to</span>
                  <h2 style={{ margin: '2px 0 0', fontSize: 24, fontWeight: 900, color: '#fff', fontFamily: 'Georgia,serif' }}>Pro</h2>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: 0, fontSize: 28, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{billingCycle === 'monthly' ? 'R49.99' : 'R499'}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{billingCycle === 'monthly' ? 'per month' : 'per year · save R101'}</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 0, marginTop: 14, background: 'rgba(0,0,0,0.2)', borderRadius: 10, padding: 3 }}>
                {(['monthly', 'yearly'] as const).map(c => (
                  <button key={c} onClick={() => setCycle(c)} style={{ flex: 1, padding: '7px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', transition: 'all .14s', background: billingCycle === c ? '#fff' : 'transparent', color: billingCycle === c ? CR : 'rgba(255,255,255,0.65)' }}>
                    {c === 'monthly' ? 'Monthly' : 'Yearly · save R101'}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ background: '#fff', padding: '18px 20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px', marginBottom: 16 }}>
                {['Unlimited packages','Unlimited photos','WhatsApp button on profile','90-day analytics','Verification eligible','Featured placement eligible','Priority in marketplace','Full quote management'].map(f => (
                  <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
                    <div style={{ flexShrink: 0, marginTop: 1 }}><CheckIcon /></div>
                    <span style={{ fontSize: 12.5, color: DK, lineHeight: 1.4 }}>{f}</span>
                  </div>
                ))}
              </div>
              <button onClick={() => initiatePayment('pro')} disabled={submitting !== null}
                style={{ width: '100%', padding: '14px', borderRadius: 12, border: 'none', cursor: submitting ? 'default' : 'pointer', background: `linear-gradient(135deg,${CR},${CR2})`, color: '#fff', fontSize: 15, fontWeight: 800, fontFamily: 'inherit', boxShadow: `0 4px 18px rgba(154,33,67,0.3)`, opacity: submitting ? .65 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all .15s' }}>
                {submitting === 'pro' && <div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />}
                {submitting === 'pro' ? 'Redirecting to PayFast…' : `Upgrade to Pro — ${billingCycle === 'monthly' ? 'R49.99/mo' : 'R499/yr'}`}
              </button>
              <p style={{ margin: '8px 0 0', fontSize: 11, color: MUT, textAlign: 'center' }}>Cancel anytime. No hidden fees. Secured by PayFast.</p>
            </div>
          </div>
        )}

        {/* ── Free vs Pro comparison ─────────────── */}
        {!isPro && (
          <div style={{ borderRadius: 16, border: `1.5px solid ${BOR}`, background: '#fff', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: `1px solid ${BOR}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: DK }}>Free vs Pro</p>
              <div style={{ display: 'flex', gap: 20 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: MUT, width: 60, textAlign: 'right' }}>Free</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: CR, width: 90, textAlign: 'right' }}>Pro</span>
              </div>
            </div>
            {[
              { label: 'Packages',       free: 'Up to 2',  pro: 'Unlimited' },
              { label: 'Photos',         free: 'Up to 6',  pro: 'Unlimited' },
              { label: 'Analytics',      free: '7 days',   pro: '90 days' },
              { label: 'WhatsApp button',free: 'No',       pro: 'Yes' },
              { label: 'Verification',   free: 'No',       pro: 'Eligible (R99)' },
              { label: 'Boost & Ads',    free: 'No',       pro: 'Eligible (R199)' },
            ].map((row, i, arr) => (
              <div key={row.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12.5, padding: '11px 18px', borderBottom: i < arr.length - 1 ? `1px solid ${BOR}` : 'none' }}>
                <span style={{ color: MUT, fontWeight: 500 }}>{row.label}</span>
                <div style={{ display: 'flex', gap: 20 }}>
                  <span style={{ color: row.free === 'No' ? '#dc2626' : MUT, width: 60, textAlign: 'right' }}>{row.free}</span>
                  <span style={{ color: CR, fontWeight: 700, width: 90, textAlign: 'right' }}>{row.pro}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Verification ──────────────────────── */}
        <div id="verification" style={{ borderRadius: 16, border: isVerified ? '1.5px solid #86efac' : `1.5px solid ${BOR}`, background: isVerified ? '#f0fdf4' : '#fff', overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', background: isVerified ? '#dcfce7' : 'linear-gradient(135deg,#0f0c29,#302b63)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: isVerified ? '#16a34a' : 'rgba(189,152,63,0.2)', border: `1.5px solid ${isVerified ? '#16a34a' : 'rgba(189,152,63,0.4)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="16" height="16" fill="none" stroke={isVerified ? '#fff' : '#BD983F'} strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: isVerified ? '#15803d' : '#fff' }}>{isVerified ? 'Verified Business' : 'Get Verified'}</p>
                <p style={{ margin: '1px 0 0', fontSize: 11, color: isVerified ? '#16a34a' : 'rgba(255,255,255,0.5)' }}>{isVerified ? 'Your badge is live on your profile' : 'One-time fee · R99 · No renewals ever'}</p>
              </div>
            </div>
            {isVerified && <span style={{ fontSize: 10, fontWeight: 800, padding: '4px 10px', borderRadius: 20, background: '#16a34a', color: '#fff' }}>VERIFIED</span>}
          </div>

          {!isVerified && (
            <div style={{ padding: '14px 18px' }}>
              {['Verified shield badge on your profile','Higher placement in marketplace search','Build instant trust with couples','One-time payment — badge is permanent','Full refund if your business cannot be verified'].map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                  <div style={{ flexShrink: 0, marginTop: 1 }}><CheckIcon color="#302b63" /></div>
                  <span style={{ fontSize: 12.5, color: DK }}>{f}</span>
                </div>
              ))}

              {verificationStatus === 'paid_pending_review' ? (
                <div style={{ marginTop: 12, padding: '12px 16px', borderRadius: 12, background: '#fffbeb', border: '1.5px solid #fbbf24', color: '#92400e', fontSize: 13, textAlign: 'center' }}>
                  Payment received — our team is reviewing your profile (usually 48 hours).
                </div>
              ) : (
                <div style={{ marginTop: 12 }}>
                  {!isPro && <div style={{ padding: '10px 14px', borderRadius: 10, background: '#fff7ed', border: '1px solid #fed7aa', marginBottom: 10, fontSize: 12, color: '#9a3412' }}>Verification is available on Pro plan only. Upgrade first.</div>}
                  <button onClick={() => isPro && initiatePayment('verification')} disabled={!isPro || submitting !== null}
                    style={{ width: '100%', padding: '13px', borderRadius: 12, border: 'none', cursor: isPro && !submitting ? 'pointer' : 'default', background: isPro ? 'linear-gradient(135deg,#0f0c29,#302b63)' : '#e5e7eb', color: isPro ? '#fff' : '#9ca3af', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: isPro ? '0 3px 12px rgba(15,12,41,0.22)' : 'none', opacity: submitting && submitting !== 'verification' ? .5 : 1, transition: 'all .15s' }}>
                    {submitting === 'verification' && <div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />}
                    {submitting === 'verification' ? 'Redirecting…' : 'Apply for Verification — R99'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Boost & Ads ───────────────────────── */}
        <div id="boost" style={{ borderRadius: 16, border: '2px solid rgba(189,152,63,0.4)', background: '#fff', overflow: 'hidden', boxShadow: '0 4px 20px rgba(189,152,63,0.1)' }}>
          <div style={{ padding: '16px 20px', background: 'linear-gradient(135deg,#7c5c0a,#BD983F)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.65)', letterSpacing: 1, textTransform: 'uppercase' }}>Advertise</p>
              <h3 style={{ margin: '2px 0 0', fontSize: 18, fontWeight: 800, color: '#fff', fontFamily: 'Georgia,serif' }}>Boost & Sponsor</h3>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#fff' }}>R199</p>
              <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>per month</p>
            </div>
          </div>

          <div style={{ padding: '16px 20px' }}>
            {['Featured at top of marketplace','Sponsored ad cards in marketplace scroll','Your ads appear in the Couples Community feed','Star badge and "Sponsored" label on your profile card','Custom headline, message, and call-to-action','30-day campaign · renew anytime'].map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                <div style={{ flexShrink: 0, marginTop: 1 }}><CheckIcon color="#BD983F" /></div>
                <span style={{ fontSize: 12.5, color: DK }}>{f}</span>
              </div>
            ))}

            {/* Ad creative form */}
            <div style={{ padding: '14px 16px', borderRadius: 12, background: '#fdfaf4', border: '1.5px solid rgba(189,152,63,0.25)', margin: '16px 0' }}>
              <p style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 800, color: '#7c5c0a', letterSpacing: 0.5, textTransform: 'uppercase' }}>Your Ad Creative</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: MUT, marginBottom: 5, letterSpacing: 0.8, textTransform: 'uppercase' }}>Headline</label>
                  <input type="text" value={ad.headline} placeholder="e.g. Book Luminary Photography for your big day" maxLength={60}
                    onFocus={() => setAdFocused('h')} onBlur={() => setAdFocused('')}
                    onChange={e => setAd({ ...ad, headline: e.target.value })} style={IS('h')} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: MUT, marginBottom: 5, letterSpacing: 0.8, textTransform: 'uppercase' }}>Short description</label>
                  <textarea value={ad.body} placeholder="Capturing memories across South Africa — 5-star rated, over 200 weddings shot." rows={2} maxLength={120}
                    onFocus={() => setAdFocused('b')} onBlur={() => setAdFocused('')}
                    onChange={e => setAd({ ...ad, body: e.target.value })} style={{ ...IS('b'), resize: 'none' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: MUT, marginBottom: 5, letterSpacing: 0.8, textTransform: 'uppercase' }}>Button label</label>
                  <input type="text" value={ad.cta} placeholder="View Profile" maxLength={24}
                    onFocus={() => setAdFocused('c')} onBlur={() => setAdFocused('')}
                    onChange={e => setAd({ ...ad, cta: e.target.value })} style={IS('c')} />
                </div>
              </div>
            </div>

            {!isPro && <div style={{ padding: '10px 14px', borderRadius: 10, background: '#fff7ed', border: '1px solid #fed7aa', marginBottom: 10, fontSize: 12, color: '#9a3412' }}>Boost is available on Pro plan only. Upgrade first.</div>}
            <button onClick={() => isPro && initiatePayment('boost')} disabled={!isPro || submitting !== null}
              style={{ width: '100%', padding: '13px', borderRadius: 12, border: 'none', cursor: isPro && !submitting ? 'pointer' : 'default', background: isPro ? 'linear-gradient(135deg,#7c5c0a,#BD983F)' : '#e5e7eb', color: isPro ? '#fff' : '#9ca3af', fontSize: 14, fontWeight: 800, fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: isPro ? '0 4px 16px rgba(189,152,63,0.3)' : 'none', opacity: submitting && submitting !== 'boost' ? .5 : 1, transition: 'all .15s' }}>
              {submitting === 'boost' && <div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />}
              {submitting === 'boost' ? 'Redirecting…' : 'Start 30-day Boost Campaign — R199'}
            </button>
            <p style={{ margin: '8px 0 0', fontSize: 11, color: MUT, textAlign: 'center' }}>Your ads go live instantly after payment is confirmed.</p>
          </div>
        </div>

        {/* PayFast note */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 12, background: '#fff', border: `1px solid ${BOR}` }}>
          <svg width="22" height="22" fill="none" stroke={MUT} strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
          <div>
            <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: DK }}>Secured by PayFast</p>
            <p style={{ margin: '1px 0 0', fontSize: 11, color: MUT }}>SA's leading payment gateway. EFT, cards & instant EFT supported.</p>
          </div>
        </div>
      </div>

      <VendorBottomNav />
    </div>
  );
}
