'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

/* ─── Brand tokens ───────────────────────────────────────── */
const CR  = '#9A2143';
const CR2 = '#731832';
const CRX = '#4d0f21';
const GD  = '#BD983F';
const DK  = '#1a0d12';
const MUT = '#7a5060';
const BOR = '#e8d5d0';
const BG  = '#faf8f5';

/* ─── Profile data ───────────────────────────────────────── */
interface ProfileData {
  has_couple: boolean;
  has_vendor: boolean;
  active_role: 'couple' | 'vendor';
  couple_name?: string | null;
  vendor_name?: string | null;
  avatar_url?: string | null;
}

/* ─── Role card ──────────────────────────────────────────── */
function RoleCard({
  role, title, subtitle, icon, emoji, isActive, hasRole,
  onSwitch, onSetup, switching,
}: {
  role: 'couple' | 'vendor';
  title: string; subtitle: string; icon: string; emoji: string;
  isActive: boolean; hasRole: boolean;
  onSwitch: () => void; onSetup: () => void; switching: boolean;
}) {
  const accentColor = role === 'couple' ? CR : '#1d6fa8';
  const accentBg    = role === 'couple' ? 'rgba(154,33,67,0.07)' : 'rgba(29,111,168,0.07)';
  const accentBorder = role === 'couple' ? 'rgba(154,33,67,0.2)' : 'rgba(29,111,168,0.2)';

  return (
    <div style={{
      background: '#fff', borderRadius: 20, overflow: 'hidden',
      border: isActive ? `2px solid ${accentColor}` : `1.5px solid ${BOR}`,
      boxShadow: isActive ? `0 4px 24px ${role === 'couple' ? 'rgba(154,33,67,0.12)' : 'rgba(29,111,168,0.12)'}` : '0 2px 8px rgba(26,13,18,0.04)',
      transition: 'all .2s',
    }}>
      {/* Active stripe */}
      {isActive && <div style={{ height: 3, background: `linear-gradient(90deg, ${accentColor}, ${role === 'couple' ? CR2 : '#155a8a'})` }} />}

      <div style={{ padding: '20px 20px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          {/* Icon */}
          <div style={{ width: 52, height: 52, borderRadius: 15, background: accentBg, border: `1.5px solid ${accentBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
            {emoji}
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: DK, fontFamily: 'Georgia,serif' }}>{title}</p>
              {isActive && (
                <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 20, background: accentBg, border: `1px solid ${accentBorder}`, color: accentColor, letterSpacing: .4 }}>
                  ACTIVE
                </span>
              )}
            </div>
            <p style={{ margin: 0, fontSize: 12.5, color: MUT, lineHeight: 1.5 }}>{subtitle}</p>
          </div>
        </div>

        {/* Features */}
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 7 }}>
          {(role === 'couple'
            ? ['Plan your wedding timeline & tasks', 'Manage budget across all vendors', 'Browse & book top wedding vendors', 'Send digital invites to guests']
            : ['Showcase your services to couples', 'Receive booking requests & quotes', 'Manage availability calendar', 'View earnings & analytics']
          ).map(f => (
            <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 16, height: 16, borderRadius: '50%', background: accentBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="8" height="8" fill="none" stroke={accentColor} strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                </svg>
              </div>
              <span style={{ fontSize: 12, color: MUT }}>{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer CTA */}
      <div style={{ padding: '12px 20px 18px' }}>
        {isActive ? (
          <div style={{ padding: '10px 14px', borderRadius: 12, background: accentBg, border: `1px solid ${accentBorder}`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="14" height="14" fill="none" stroke={accentColor} strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
            </svg>
            <span style={{ fontSize: 13, fontWeight: 700, color: accentColor }}>Currently active — you're in this view</span>
          </div>
        ) : hasRole ? (
          <button onClick={onSwitch} disabled={switching} style={{
            width: '100%', padding: '12px', borderRadius: 12, border: 'none',
            background: `linear-gradient(135deg,${accentColor},${role === 'couple' ? CR2 : '#155a8a'})`,
            color: '#fff', fontSize: 14, fontWeight: 800, cursor: switching ? 'default' : 'pointer',
            opacity: switching ? .7 : 1,
            boxShadow: `0 3px 14px ${role === 'couple' ? 'rgba(154,33,67,0.25)' : 'rgba(29,111,168,0.25)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            transition: 'opacity .14s',
          }}>
            {switching && <div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'rsSpin .8s linear infinite' }} />}
            {switching ? 'Switching…' : `Switch to ${role === 'couple' ? 'Couple' : 'Vendor'} view →`}
          </button>
        ) : (
          <button onClick={onSetup} style={{
            width: '100%', padding: '12px', borderRadius: 12,
            border: `1.5px solid ${accentBorder}`, background: accentBg,
            color: accentColor, fontSize: 14, fontWeight: 800, cursor: 'pointer',
            transition: 'all .14s',
          }}>
            Set up {role === 'couple' ? 'a couple' : 'a vendor'} account →
          </button>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── */
function SwitchRoleContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [switching, setSwitching] = useState<'couple' | 'vendor' | null>(null);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.push('/auth/sign-in'); return; }

        // Load profile flags
        const { data: prof } = await supabase
          .from('profiles')
          .select('has_couple, has_vendor, active_role')
          .eq('id', user.id)
          .maybeSingle();

        const hasCouple = Boolean(prof?.has_couple);
        const hasVendor = Boolean(prof?.has_vendor);
        const activeRole: 'couple' | 'vendor' = (prof?.active_role as any) || 'couple';

        // Load display names
        let coupleName: string | null = null;
        let vendorName: string | null = null;

        if (hasCouple) {
          const { data: c } = await supabase.from('couples').select('partner_name').eq('id', user.id).maybeSingle();
          coupleName = c?.partner_name || null;
        }
        if (hasVendor) {
          const { data: v } = await supabase.from('vendors').select('business_name').or(`id.eq.${user.id},user_id.eq.${user.id}`).limit(1).maybeSingle();
          vendorName = v?.business_name || null;
        }

        setProfile({ has_couple: hasCouple, has_vendor: hasVendor, active_role: activeRole, couple_name: coupleName, vendor_name: vendorName });
      } catch (err) {
        console.error('SwitchRole: load error', err);
        setError('Could not load your profile. Please try again.');
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const handleSwitch = async (targetRole: 'couple' | 'vendor') => {
    if (!profile) return;
    setSwitching(targetRole);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/sign-in'); return; }

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ active_role: targetRole })
        .eq('id', user.id);

      if (updateError) throw updateError;

      // Small delay so user sees the animation
      await new Promise(r => setTimeout(r, 600));

      const target = searchParams?.get('target');
      if (target) { router.replace(decodeURIComponent(target)); return; }
      router.replace(targetRole === 'vendor' ? '/vendor/dashboard' : '/couple/dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to switch. Please try again.');
      setSwitching(null);
    }
  };

  const handleSetup = (role: 'couple' | 'vendor') => {
    router.push(role === 'vendor' ? '/vendor/onboarding' : '/couple/onboarding');
  };

  if (loading) return (
    <div style={{ minHeight: '100svh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14 }}>
      <style>{'@keyframes rsSpin{to{transform:rotate(360deg)}}'}</style>
      <div style={{ width: 38, height: 38, border: `3px solid rgba(154,33,67,0.12)`, borderTopColor: CR, borderRadius: '50%', animation: 'rsSpin .8s linear infinite' }} />
      <p style={{ margin: 0, fontSize: 13, color: MUT, fontWeight: 600 }}>Loading your accounts…</p>
    </div>
  );

  return (
    <div style={{ minHeight: '100svh', background: BG, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`
        @keyframes rsSpin{to{transform:rotate(360deg)}}
        @keyframes rsUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        .rs1{animation:rsUp .4s ease .05s both}.rs2{animation:rsUp .4s ease .12s both}
        .rs3{animation:rsUp .4s ease .18s both}
        button{font-family:inherit!important}
      `}</style>

      {/* Header */}
      <div style={{
        background: `linear-gradient(160deg, ${CRX} 0%, ${CR} 52%, #c03050 100%)`,
        padding: '22px 20px 26px', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -60, right: -60, width: 220, height: 220, borderRadius: '50%', border: '1.5px solid rgba(189,152,63,0.1)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: -30, right: -30, width: 130, height: 130, borderRadius: '50%', border: '1.5px solid rgba(189,152,63,0.16)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,transparent,${GD},transparent)` }} />

        <div style={{ position: 'relative' }}>
          {/* Back button */}
          <button onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 20, padding: '6px 12px', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', marginBottom: 16 }}>
            <svg width="12" height="12" fill="none" stroke="#fff" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
            </svg>
            Back
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <img src="/logo-icon.png" alt="" style={{ width: 30, height: 30, filter: 'brightness(0) invert(1)', opacity: .85, objectFit: 'contain' }} />
            <p style={{ margin: 0, fontSize: 10, color: 'rgba(255,255,255,0.5)', letterSpacing: 1.3, textTransform: 'uppercase', fontWeight: 700 }}>uMshado</p>
          </div>
          <h1 style={{ margin: '0 0 5px', fontSize: 22, fontWeight: 800, color: '#fff', fontFamily: 'Georgia,serif' }}>Switch Account</h1>
          <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>
            Toggle between your couple planning view and vendor dashboard — same login, different experience.
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '20px 16px 40px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Error */}
        {error && (
          <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(192,50,42,0.07)', border: '1.5px solid rgba(192,50,42,0.2)' }}>
            <p style={{ margin: 0, fontSize: 13, color: '#c0322a', fontWeight: 600 }}>{error}</p>
          </div>
        )}

        {/* Info banner for dual-role users */}
        {profile?.has_couple && profile?.has_vendor && (
          <div className="rs1" style={{ padding: '12px 16px', borderRadius: 14, background: `rgba(189,152,63,0.07)`, border: `1.5px solid rgba(189,152,63,0.2)`, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>✨</span>
            <div>
              <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 800, color: '#7a5010' }}>Dual account detected</p>
              <p style={{ margin: 0, fontSize: 12, color: '#9a6820', lineHeight: 1.5 }}>
                You have both a couple and vendor account. Switch views anytime — your data is kept separate.
              </p>
            </div>
          </div>
        )}

        {/* Role cards */}
        <div className="rs2">
          <RoleCard
            role="couple"
            title={profile?.couple_name ? profile.couple_name : 'Couple Account'}
            subtitle="Plan your wedding, manage guests, budget and vendors"
            icon="💍" emoji="💑"
            isActive={profile?.active_role === 'couple'}
            hasRole={Boolean(profile?.has_couple)}
            onSwitch={() => handleSwitch('couple')}
            onSetup={() => handleSetup('couple')}
            switching={switching === 'couple'}
          />
        </div>

        <div className="rs3">
          <RoleCard
            role="vendor"
            title={profile?.vendor_name ? profile.vendor_name : 'Vendor Account'}
            subtitle="Manage your wedding business, packages and bookings"
            icon="💼" emoji="🏢"
            isActive={profile?.active_role === 'vendor'}
            hasRole={Boolean(profile?.has_vendor)}
            onSwitch={() => handleSwitch('vendor')}
            onSetup={() => handleSetup('vendor')}
            switching={switching === 'vendor'}
          />
        </div>

        {/* Footer note */}
        <p style={{ margin: 0, fontSize: 11.5, color: MUT, textAlign: 'center', lineHeight: 1.6 }}>
          Your couple and vendor accounts are completely separate. Switching never mixes your data.
        </p>
      </div>
    </div>
  );
}

export default function SwitchRolePage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100svh', background: '#faf8f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <style>{'@keyframes rsSpin{to{transform:rotate(360deg)}}'}</style>
        <div style={{ width: 36, height: 36, border: '3px solid rgba(154,33,67,0.12)', borderTopColor: '#9A2143', borderRadius: '50%', animation: 'rsSpin .8s linear infinite' }} />
      </div>
    }>
      <SwitchRoleContent />
    </Suspense>
  );
}
