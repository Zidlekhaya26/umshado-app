"use client";

import { useState } from "react";
import { getUserOrRedirect, upsertCouple } from '@/lib/onboarding';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from "next/navigation";
import CurrencySelector from '@/components/CurrencySelector';
import { useCurrency } from '@/app/providers/CurrencyProvider';
import Image from 'next/image';
import { CR, CR2, CRX, GD, DK, MUT, BOR, BG } from '@/lib/tokens';

/* ─── Brand tokens ───────────────────────────────────────── */

/* ─── Onboarding header ──────────────────────────────────── */
function OnboardingHeader() {
  return (
    <div style={{
      background: `linear-gradient(160deg, ${CRX} 0%, ${CR} 52%, #c03050 100%)`,
      padding: '22px 20px 28px', position: 'relative', overflow: 'hidden',
    }}>
      {/* Decorative rings */}
      <div style={{ position: 'absolute', top: -60, right: -60, width: 220, height: 220, borderRadius: '50%', border: '1.5px solid rgba(189,152,63,0.1)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: -30, right: -30, width: 130, height: 130, borderRadius: '50%', border: '1.5px solid rgba(189,152,63,0.16)', pointerEvents: 'none' }} />
      {/* Floating diamonds */}
      <div style={{ position: 'absolute', top: 28, right: 80, width: 6, height: 6, background: 'rgba(189,152,63,0.35)', transform: 'rotate(45deg)', borderRadius: 1 }} />
      <div style={{ position: 'absolute', top: 55, right: 55, width: 4, height: 4, background: 'rgba(255,255,255,0.2)', transform: 'rotate(45deg)', borderRadius: 1 }} />
      <div style={{ position: 'absolute', bottom: 22, left: 30, width: 5, height: 5, background: 'rgba(189,152,63,0.25)', transform: 'rotate(45deg)', borderRadius: 1 }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,transparent,${GD},transparent)` }} />

      <div style={{ position: 'relative' }}>
        {/* Logo + brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <Image src="/logo-icon.png" alt="uMshado" width={34} height={34} style={{ objectFit: 'contain', filter: 'brightness(0) invert(1)', opacity: .88 }} />
          <div>
            <p style={{ margin: 0, fontSize: 10, color: 'rgba(255,255,255,0.45)', letterSpacing: 1.3, textTransform: 'uppercase', fontWeight: 700 }}>uMshado</p>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#fff', fontFamily: 'Georgia,serif' }}>Welcome to the family 💍</p>
          </div>
        </div>

        {/* Hero text */}
        <div style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.08)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)' }}>
          <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 800, color: '#fff', fontFamily: 'Georgia,serif' }}>Let&apos;s plan your dream wedding 🎊</p>
          <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
            Tell us about your big day so we can connect you with the perfect vendors and tools.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── Input field ────────────────────────────────────────── */
function Field({
  label, id, name, type = 'text', value, onChange, required, placeholder, hint,
}: {
  label: string; id: string; name: string; type?: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  required?: boolean; placeholder?: string; hint?: string;
}) {
  const [focused, setFocused] = useState(false);
  const base: React.CSSProperties = {
    width: '100%', padding: type === 'date' ? '0 14px' : '13px 14px',
    height: type === 'date' ? 48 : undefined,
    borderRadius: 12, outline: 'none', boxSizing: 'border-box',
    fontSize: 14, color: DK, fontFamily: 'inherit',
    border: `1.5px solid ${focused ? CR : BOR}`, background: '#fff',
    boxShadow: focused ? `0 0 0 3px rgba(154,33,67,0.09)` : 'none',
    transition: 'border-color .14s, box-shadow .14s',
    appearance: type === 'date' ? 'none' : undefined,
  };
  return (
    <div>
      <label htmlFor={id} style={{ display: 'block', fontSize: 10.5, fontWeight: 800, letterSpacing: 1.1, textTransform: 'uppercase', color: MUT, marginBottom: 8 }}>
        {label}{required && <span style={{ color: CR, marginLeft: 3 }}>*</span>}
      </label>
      <input
        id={id} name={name} type={type} value={value}
        onChange={onChange} placeholder={placeholder} required={required}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={base}
      />
      {hint && <p style={{ margin: '5px 0 0', fontSize: 11.5, color: MUT }}>{hint}</p>}
    </div>
  );
}

function TextareaField({
  label, id, name, value, onChange, placeholder, hint,
}: {
  label: string; id: string; name: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  placeholder?: string; hint?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <label htmlFor={id} style={{ display: 'block', fontSize: 10.5, fontWeight: 800, letterSpacing: 1.1, textTransform: 'uppercase', color: MUT, marginBottom: 8 }}>
        {label} <span style={{ fontSize: 10, fontWeight: 600, color: MUT, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
      </label>
      <textarea
        id={id} name={name} value={value} rows={4}
        onChange={onChange} placeholder={placeholder}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{
          width: '100%', padding: '13px 14px', borderRadius: 12, outline: 'none',
          boxSizing: 'border-box', fontSize: 14, color: DK, fontFamily: 'inherit',
          border: `1.5px solid ${focused ? CR : BOR}`, background: '#fff',
          boxShadow: focused ? `0 0 0 3px rgba(154,33,67,0.09)` : 'none',
          resize: 'none', transition: 'border-color .14s, box-shadow .14s',
        }}
      />
      {hint && <p style={{ margin: '5px 0 0', fontSize: 11.5, color: MUT }}>{hint}</p>}
    </div>
  );
}

/* ─── Countdown chip ─────────────────────────────────────── */
function WeddingCountdown({ dateStr }: { dateStr: string }) {
  if (!dateStr) return null;
  const date = new Date(dateStr + 'T00:00:00');
  const now  = new Date();
  const diff = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return null;
  const months = Math.floor(diff / 30);
  const label  = months > 1 ? `${months} months to go` : diff === 0 ? 'Today! 🎊' : `${diff} days to go`;
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 20, background: `rgba(189,152,63,0.1)`, border: `1px solid rgba(189,152,63,0.3)`, marginTop: 7 }}>
      <span style={{ fontSize: 13 }}>💍</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--um-gold-dark)' }}>{label}</span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════ */
export default function CoupleOnboarding() {
  const router  = useRouter();
  const { currency } = useCurrency();
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    weddingDate: '', yourName: '', partnerName: '', weddingLocation: '',
    country: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const user = await getUserOrRedirect();
      if (!user) { alert('Please sign in to continue.'); router.push('/auth/sign-in'); return; }
      // Save user's own name to profiles.full_name
      if (formData.yourName.trim()) {
        await supabase.from('profiles').update({ full_name: formData.yourName.trim() }).eq('id', user.id);
      }
      const res = await upsertCouple(user.id, {
        partner_name: formData.partnerName || null,
        wedding_date: formData.weddingDate || null,
        location: formData.weddingLocation || null,
        country: formData.country || null,

        currency,
      });
      if (!res.success) { alert('Failed to save: ' + (res.error || 'unknown')); return; }
      router.push('/couple/dashboard');
    } catch (err) {
      alert('An error occurred: ' + err);
    } finally { setSubmitting(false); }
  };

  return (
    <div style={{ minHeight: '100svh', background: BG, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`
        @keyframes coSpin{to{transform:rotate(360deg)}}
        @keyframes coUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        .co1{animation:coUp .4s ease .05s both}.co2{animation:coUp .4s ease .1s both}
        .co3{animation:coUp .4s ease .15s both}.co4{animation:coUp .4s ease .2s both}
        .co5{animation:coUp .4s ease .25s both}.co6{animation:coUp .4s ease .3s both}
        input,textarea,button{font-family:inherit!important}
        .co-submit:hover:not(:disabled){box-shadow:0 6px 24px rgba(154,33,67,0.36)!important;transform:translateY(-1px)}
        .co-submit{transition:box-shadow .14s,transform .14s}
      `}</style>

      <OnboardingHeader />

      {/* Currency selector */}
      <div style={{ background: '#fff', borderBottom: `1px solid ${BOR}`, padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ margin: 0, fontSize: 12, color: MUT, fontWeight: 600 }}>Currency for your planning</p>
        <CurrencySelector />
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ maxWidth: 600, margin: '0 auto', padding: '24px 16px 120px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Wedding date */}
          <div className="co1">
            <Field
              label="Wedding date" id="weddingDate" name="weddingDate" type="date"
              value={formData.weddingDate} onChange={handleChange} required
            />
            <WeddingCountdown dateStr={formData.weddingDate} />
          </div>

          {/* Your name */}
          <div className="co2">
            <Field
              label="Your name" id="yourName" name="yourName"
              value={formData.yourName} onChange={handleChange} required
              placeholder="e.g. Thabi"
            />
          </div>

          {/* Partner's name */}
          <div className="co2">
            <Field
              label="Partner's name" id="partnerName" name="partnerName"
              value={formData.partnerName} onChange={handleChange} required
              placeholder="e.g. Mthabi"
            />
          </div>

          {/* Location + country */}
          <div className="co3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field
              label="Venue / city" id="weddingLocation" name="weddingLocation"
              value={formData.weddingLocation} onChange={handleChange} required
              placeholder="e.g. Sandton, Joburg"
            />
            <Field
              label="Country" id="country" name="country"
              value={formData.country} onChange={handleChange} required
              placeholder="e.g. South Africa"
            />
          </div>


          {/* What you get card */}
          <div className="co5" style={{ background: '#fff', borderRadius: 16, border: `1.5px solid ${BOR}`, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${BOR}`, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14 }}>✨</span>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: DK, letterSpacing: .3 }}>What you unlock after setup</p>
            </div>
            <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                ['📋', 'Smart wedding task planner', 'Auto-generated checklist based on your date'],
                ['💰', 'Budget tracker', 'Track every spend across all vendors'],
                ['🎁', 'Gift registry', 'Share a public wishlist with guests'],
                ['📩', 'Invite manager', 'Send digital invites and track RSVPs'],
                ['🤖', 'Ami, your AI wedding assistant', 'Get instant planning advice, anytime'],
              ].map(([icon, title, sub]) => (
                <div key={title as string} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{ fontSize: 16, marginTop: 1 }}>{icon}</span>
                  <div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: DK }}>{title}</p>
                    <p style={{ margin: 0, fontSize: 11.5, color: MUT }}>{sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sticky footer */}
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff',
          borderTop: `1px solid ${BOR}`, padding: 'calc(14px) 16px calc(14px + env(safe-area-inset-bottom))',
          boxShadow: '0 -4px 20px rgba(26,13,18,0.06)', zIndex: 40,
        }}>
          <div style={{ maxWidth: 600, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button type="submit" disabled={submitting} className="co-submit" style={{
              width: '100%', padding: '14px', borderRadius: 13, border: 'none',
              background: `linear-gradient(135deg,${CR} 0%,${CR2} 100%)`,
              color: '#fff', fontSize: 15, fontWeight: 800,
              boxShadow: '0 4px 18px rgba(154,33,67,0.28)',
              opacity: submitting ? .65 : 1, cursor: submitting ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              {submitting && <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'coSpin .8s linear infinite' }} />}
              {submitting ? 'Setting up your dashboard…' : "Let's start planning 🎊"}
            </button>
            <p style={{ margin: 0, fontSize: 11, color: MUT, textAlign: 'center' }}>
              Your information helps us personalise your wedding planning experience
            </p>
          </div>
        </div>
      </form>
    </div>
  );
}
