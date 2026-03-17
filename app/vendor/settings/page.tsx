'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useRef, useState, Suspense } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import VendorBottomNav from '@/components/VendorBottomNav';
import PushNotificationsToggle from '@/components/PushNotificationsToggle';
import { useCurrency } from '@/app/providers/CurrencyProvider';
import { LOCKED_CATEGORIES } from '@/lib/marketplaceCategories';

/* ─── Design tokens ──────────────────────────────────────── */
const C = {
  crimson:     'var(--um-crimson)',
  crimsonDark: 'var(--um-crimson-dark)',
  crimsonDim:  'rgba(154,33,67,0.10)',
  crimsonGlow: 'rgba(154,33,67,0.22)',
  gold:        'var(--um-gold)',
  goldDim:     'rgba(189,152,63,0.12)',
  dark:        'var(--um-dark)',
  bg:          'var(--um-ivory)',
  card:        '#ffffff',
  border:      '#f0ebe4',
  muted:       'var(--um-muted)',
  text:        '#2d1a22',
  success:     '#1e7c4a',
  successDim:  'rgba(30,124,74,0.1)',
  error:       '#c0322a',
  errorDim:    'rgba(192,50,42,0.08)',
  blue:        '#1d6fa8',
  blueDim:     'rgba(29,111,168,0.1)',
};

const grad = {
  header:  'linear-gradient(160deg, var(--um-crimson-deep) 0%, var(--um-crimson) 55%, var(--um-crimson-mid) 100%)',
  gold:    `linear-gradient(135deg, ${C.gold}, #9a7a2a)`,
  primary: `linear-gradient(135deg, ${C.crimson}, ${C.crimsonDark})`,
};

/* ─── Toggle ─────────────────────────────────────────────── */
function Toggle({ on, onChange, disabled }: { on: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button onClick={onChange} disabled={disabled}
      style={{
        width: 46, height: 26, borderRadius: 13, border: 'none', cursor: disabled ? 'default' : 'pointer',
        background: on ? C.crimson : '#d1d5db', position: 'relative', transition: 'background 0.2s',
        flexShrink: 0, opacity: disabled ? 0.5 : 1,
      }}>
      <span style={{
        position: 'absolute', top: 3, left: on ? 23 : 3, width: 20, height: 20,
        borderRadius: '50%', background: '#fff', transition: 'left 0.2s',
        boxShadow: '0 1px 4px rgba(0,0,0,0.2)', display: 'block',
      }} />
    </button>
  );
}

/* ─── Section ────────────────────────────────────────────── */
function Section({ title, children, icon }: { title: string; children: React.ReactNode; icon?: string }) {
  return (
    <div style={{ background: C.card, borderRadius: 20, overflow: 'hidden', border: `1.5px solid ${C.border}`, boxShadow: '0 2px 12px rgba(26,13,18,0.04)' }}>
      <div style={{ padding: '14px 18px 12px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
        {icon && <span style={{ fontSize: 15 }}>{icon}</span>}
        <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: C.muted, letterSpacing: 0.8, textTransform: 'uppercase', fontFamily: "'DM Sans', system-ui, sans-serif" }}>{title}</p>
      </div>
      <div>{children}</div>
    </div>
  );
}

/* ─── Row ────────────────────────────────────────────────── */
function Row({ icon, label, sub, right, onClick, danger, last }: {
  icon: React.ReactNode; label: string; sub?: string;
  right?: React.ReactNode; onClick?: () => void; danger?: boolean; last?: boolean;
}) {
  return (
    <div onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 14, padding: '13px 18px',
        borderBottom: last ? 'none' : `1px solid ${C.border}`,
        cursor: onClick ? 'pointer' : 'default', background: 'transparent', transition: 'background 0.12s',
      }}
      onMouseEnter={e => { if (onClick) (e.currentTarget as HTMLDivElement).style.background = danger ? C.errorDim : C.crimsonDim; }}
      onMouseLeave={e => { if (onClick) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
    >
      <div style={{ width: 38, height: 38, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: danger ? C.errorDim : C.crimsonDim }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: danger ? C.error : C.text }}>{label}</p>
        {sub && <p style={{ margin: '2px 0 0', fontSize: 11, color: C.muted }}>{sub}</p>}
      </div>
      {right}
      {onClick && !right && (
        <svg width="14" height="14" fill="none" stroke={danger ? C.error : C.muted} strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      )}
    </div>
  );
}

/* ─── Field label ────────────────────────────────────────── */
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: C.muted, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 7, fontFamily: "'DM Sans', system-ui" }}>
        {label}{required && <span style={{ color: C.crimson, marginLeft: 3 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 14px', borderRadius: 12, border: `1.5px solid ${C.border}`,
  fontSize: 14, color: C.text, fontFamily: "'DM Sans', system-ui", background: '#fdfaf8',
  outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s',
};

const AFRICAN_COUNTRIES = [
  { name: 'South Africa', code: 'ZA' }, { name: 'Zimbabwe', code: 'ZW' },
  { name: 'Botswana', code: 'BW' }, { name: 'Namibia', code: 'NA' },
  { name: 'Zambia', code: 'ZM' }, { name: 'Mozambique', code: 'MZ' },
  { name: 'Lesotho', code: 'LS' }, { name: 'Eswatini', code: 'SZ' },
  { name: 'Kenya', code: 'KE' }, { name: 'Nigeria', code: 'NG' },
  { name: 'Ghana', code: 'GH' }, { name: 'Tanzania', code: 'TZ' },
  { name: 'Uganda', code: 'UG' }, { name: 'Rwanda', code: 'RW' },
  { name: 'Ethiopia', code: 'ET' }, { name: 'Malawi', code: 'MW' },
  { name: 'Angola', code: 'AO' }, { name: 'Other', code: '' },
];

/* ════════════════════════════════════════════════════════════
   Main page content
═══════════════════════════════════════════════════════════ */
function VendorSettingsContent() {
  const router = useRouter();

  /* auth */
  const [authEmail, setAuthEmail]   = useState<string | null>(null);
  const [authUserId, setAuthUserId] = useState<string | null>(null);

  /* vendor data */
  const [businessName, setBusinessName]       = useState('');
  const [category, setCategory]               = useState('');
  const [city, setCity]                       = useState('');
  const [country, setCountry]                 = useState('');
  const [countryCode, setCountryCode]         = useState('');
  const [description, setDescription]         = useState('');
  const [logoUrl, setLogoUrl]                 = useState<string | null>(null);
  const [vendorId, setVendorId]               = useState<string | null>(null);

  /* profile / dual-account */
  const [profile, setProfile] = useState<{
    has_couple?: boolean | null;
    has_vendor?: boolean | null;
    active_role?: 'couple' | 'vendor' | null;
  } | null>(null);

  /* ui state */
  const [loading, setLoading]                     = useState(true);
  const [savingRole, setSavingRole]               = useState<'couple' | 'vendor' | null>(null);
  const [showEditProfile, setShowEditProfile]     = useState(false);
  const [profileSaving, setProfileSaving]         = useState(false);
  const [profileSaveMsg, setProfileSaveMsg]       = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [uploadingLogo, setUploadingLogo]         = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [notifLoading, setNotifLoading]           = useState(true);
  const [showChangeEmail, setShowChangeEmail]     = useState(false);
  const [newEmail, setNewEmail]                   = useState('');
  const [emailChangeMsg, setEmailChangeMsg]       = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [emailChangeSaving, setEmailChangeSaving] = useState(false);
  const [pwResetMsg, setPwResetMsg]               = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { currency, setCurrency } = useCurrency();
  const logoInputRef = useRef<HTMLInputElement>(null);

  /* ── Load data ── */
  useEffect(() => {
    (async () => {
      try {
        const { data: ud } = await supabase.auth.getUser();
        const user = ud?.user;
        if (!user) { router.push('/auth/sign-in'); return; }
        setAuthEmail(user.email ?? null);
        setAuthUserId(user.id);

        const [profileRes, vendorRes, prefRes] = await Promise.all([
          supabase.from('profiles').select('has_couple,has_vendor,active_role').eq('id', user.id).maybeSingle(),
          supabase.from('vendors').select('id,business_name,category,location,country,country_code,description,logo_url').or(`id.eq.${user.id},user_id.eq.${user.id}`).limit(1).maybeSingle(),
          supabase.from('user_preferences').select('in_app_notifications,currency').eq('user_id', user.id).maybeSingle(),
        ]);

        setProfile({
          has_couple: profileRes.data?.has_couple ?? false,
          has_vendor: profileRes.data?.has_vendor ?? true,
          active_role: profileRes.data?.active_role ?? 'vendor',
        });

        if (vendorRes.data) {
          const v = vendorRes.data;
          setVendorId(v.id ?? null);
          setBusinessName(v.business_name ?? '');
          setCategory(v.category ?? '');
          const cityPart = (v.location ?? '').split(', ')[0] ?? '';
          setCity(cityPart);
          setCountry(v.country ?? '');
          setCountryCode(v.country_code ?? '');
          setDescription(v.description ?? '');
          setLogoUrl(v.logo_url ?? null);
        }

        if (prefRes.data) {
          setNotificationsEnabled(prefRes.data.in_app_notifications ?? true);
          if (prefRes.data.currency) setCurrency(prefRes.data.currency as any);
        }
        setNotifLoading(false);
      } catch (err) {
        console.error('VendorSettings load error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [router, setCurrency]);

  /* ── Logo upload ── */
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !authUserId || !vendorId) return;
    if (file.size > 5 * 1024 * 1024) return;
    setUploadingLogo(true);
    try {
      const ext  = file.name.split('.').pop() ?? 'jpg';
      const path = `${vendorId}/logo.${ext}`;
      await supabase.storage.from('vendor-logos').upload(path, file, { upsert: true });
      const { data: u } = supabase.storage.from('vendor-logos').getPublicUrl(path);
      await supabase.from('vendors').update({ logo_url: u.publicUrl }).eq('id', vendorId);
      setLogoUrl(u.publicUrl);
    } catch (err) { console.error(err); }
    finally { setUploadingLogo(false); }
  };

  /* ── Save business profile ── */
  const saveProfile = async () => {
    if (!authUserId || !vendorId) return;
    if (!businessName.trim()) {
      setProfileSaveMsg({ type: 'error', text: 'Business name is required.' });
      return;
    }
    setProfileSaving(true);
    setProfileSaveMsg(null);
    const location = [city.trim(), country.trim()].filter(Boolean).join(', ') || null;
    const { error } = await supabase.from('vendors').update({
      business_name: businessName.trim(),
      category:      category || null,
      location,
      country:       country.trim() || null,
      country_code:  countryCode || null,
      description:   description.trim() || null,
    }).eq('id', vendorId);
    setProfileSaving(false);
    if (error) {
      setProfileSaveMsg({ type: 'error', text: 'Failed to save. Please try again.' });
    } else {
      setProfileSaveMsg({ type: 'success', text: 'Business profile saved!' });
      setTimeout(() => { setShowEditProfile(false); setProfileSaveMsg(null); }, 1200);
    }
  };

  /* ── Role switch ── */
  const handleSwitch = async (role: 'couple' | 'vendor') => {
    if (!profile || !authUserId) return;
    setSavingRole(role);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push('/auth/sign-in'); return; }
    const res = await fetch('/api/role/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ role }),
    });
    setSavingRole(null);
    if (res.ok) {
      router.replace(role === 'vendor' ? '/vendor/dashboard' : '/couple/dashboard');
    } else {
      const body = await res.json().catch(() => ({}));
      alert(body.error || 'Failed to switch. Please try again.');
    }
  };

  /* ── Security ── */
  const handleChangePassword = async () => {
    if (!authEmail) return;
    setPwResetMsg(null);
    const { error } = await supabase.auth.resetPasswordForEmail(authEmail, {
      redirectTo: `${window.location.origin}/auth/sign-in`,
    });
    if (error) {
      setPwResetMsg({ type: 'error', text: error.message });
    } else {
      setPwResetMsg({ type: 'success', text: 'Reset link sent — check your inbox.' });
      setTimeout(() => setPwResetMsg(null), 5000);
    }
  };

  const handleChangeEmail = async () => {
    const trimmed = newEmail.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) { setEmailChangeMsg({ type: 'error', text: 'Enter a valid email address.' }); return; }
    if (trimmed === authEmail?.toLowerCase()) { setEmailChangeMsg({ type: 'error', text: 'That is already your current email.' }); return; }
    setEmailChangeSaving(true);
    setEmailChangeMsg(null);
    const { error } = await supabase.auth.updateUser({ email: trimmed });
    setEmailChangeSaving(false);
    if (error) {
      setEmailChangeMsg({ type: 'error', text: error.message });
    } else {
      setEmailChangeMsg({ type: 'success', text: 'Confirmation sent to your new email.' });
      setTimeout(() => { setShowChangeEmail(false); setNewEmail(''); setEmailChangeMsg(null); }, 2500);
    }
  };

  const handleSignOut = async () => {
    if (!confirm('Are you sure you want to sign out?')) return;
    await supabase.auth.signOut();
    router.push('/auth/sign-in');
  };

  const handleDeleteAccount = async () => {
    if (!confirm('Permanently delete your account and all data? This cannot be undone.')) return;
    const typed = window.prompt('Type DELETE to confirm:');
    if (typed !== 'DELETE') { alert('Cancelled — you must type DELETE exactly.'); return; }
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/account/delete', {
      method: 'DELETE',
      headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
    });
    if (res.ok) {
      await supabase.auth.signOut();
      router.push('/auth/sign-in');
    } else {
      const body = await res.json().catch(() => ({}));
      alert(body.error || 'Failed to delete account. Please try again.');
    }
  };

  /* ──────────────────────────────────────────────────────────
     Render
  ──────────────────────────────────────────────────────── */
  return (
    <div style={{ minHeight: '100svh', background: C.bg, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes slideUp { from { opacity:0; transform:translateY(28px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeIn  { from { opacity:0; } to { opacity:1; } }
        @keyframes sheetUp { from { opacity:0; transform:translateY(100%); } to { opacity:1; transform:translateY(0); } }
        input:focus, select:focus, textarea:focus { border-color: ${C.crimson} !important; box-shadow: 0 0 0 3px ${C.crimsonGlow}; }
      `}</style>

      <input ref={logoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoUpload} />

      <div style={{ maxWidth: 560, margin: '0 auto', paddingBottom: 110 }}>

        {/* ── Header ── */}
        <div style={{ background: grad.header, padding: '0 0 0', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -50, right: -50, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(189,152,63,0.18) 0%, transparent 65%)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: -20, left: -30, width: 140, height: 140, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 70%)', pointerEvents: 'none' }} />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 20px 0', position: 'relative' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#fff', fontFamily: 'Georgia, serif', letterSpacing: -0.3 }}>Settings</h1>
              <p style={{ margin: '3px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>Business & account preferences</p>
            </div>
            <div style={{ width: 36, height: 36, borderRadius: '50%', border: '2px solid rgba(189,152,63,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" fill="none" stroke="rgba(189,152,63,0.8)" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
          </div>

          {/* Business card */}
          <div style={{ padding: '20px 20px 24px', position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {/* Logo */}
              <button onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo}
                style={{ position: 'relative', width: 76, height: 76, borderRadius: 18, border: '3px solid rgba(189,152,63,0.6)', overflow: 'hidden', flexShrink: 0, cursor: 'pointer', background: 'rgba(255,255,255,0.12)', padding: 0 }}>
                {uploadingLogo ? (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: 22, height: 22, border: '2.5px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  </div>
                ) : logoUrl ? (
                  <Image src={logoUrl} alt="Logo" fill style={{ objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                    <svg width="22" height="22" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18" />
                    </svg>
                  </div>
                )}
                <div style={{ position: 'absolute', bottom: 2, right: 2, width: 20, height: 20, borderRadius: '50%', background: C.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid rgba(77,15,33,0.9)' }}>
                  <svg width="9" height="9" fill="#fff" viewBox="0 0 24 24"><path d="M12 15a3 3 0 100-6 3 3 0 000 6z"/><path d="M9.26 3l-1.5 2H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V7a2 2 0 00-2-2h-3.76l-1.5-2H9.26z"/></svg>
                </div>
              </button>

              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#fff', fontFamily: 'Georgia, serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {businessName || 'Your Business'}
                </p>
                {category && <p style={{ margin: '3px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>{category}</p>}
                {authEmail && <p style={{ margin: '3px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.45)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{authEmail}</p>}
              </div>
            </div>

            <button onClick={() => { setProfileSaveMsg(null); setShowEditProfile(true); }}
              style={{ marginTop: 16, width: '100%', padding: '11px', borderRadius: 14, border: '1.5px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.10)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
              <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit Business Profile
            </button>
          </div>
        </div>

        {/* ── Content ── */}
        <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Quick links */}
          <Section title="Business" icon="🏢">
            <Row
              icon={<svg width="17" height="17" fill="none" stroke={C.crimson} strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
              label="Profile & Media"
              sub="Photos, portfolio, cover image"
              onClick={() => router.push('/vendor/media')}
            />
            <Row
              icon={<svg width="17" height="17" fill="none" stroke={C.crimson} strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 10V7" /></svg>}
              label="Services & Packages"
              sub="Manage what you offer and pricing"
              onClick={() => router.push('/vendor/packages')}
            />
            <Row
              icon={<svg width="17" height="17" fill="none" stroke={C.crimson} strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
              label="Availability"
              sub="Manage your calendar & blocked dates"
              onClick={() => router.push('/vendor/availability')}
            />
            <Row
              last
              icon={<svg width="17" height="17" fill="none" stroke={C.crimson} strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>}
              label="Billing & Subscription"
              sub="Pro plan, verification badge, boost ads"
              onClick={() => router.push('/vendor/billing')}
            />
          </Section>

          {/* Switch Account */}
          <Section title="Switch Account" icon="🔄">
            {loading ? (
              <div style={{ padding: '20px', textAlign: 'center' }}>
                <div style={{ width: 24, height: 24, border: `2px solid ${C.crimsonDim}`, borderTopColor: C.crimson, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
              </div>
            ) : (
              <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {profile?.active_role && (
                  <p style={{ margin: '0 0 4px', fontSize: 11, color: C.muted }}>
                    Currently active: <strong style={{ color: C.crimson }}>{profile.active_role === 'vendor' ? 'Vendor' : 'Couple'}</strong>
                  </p>
                )}
                {(['vendor', 'couple'] as const).map(role => {
                  const available = role === 'couple' ? profile?.has_couple : profile?.has_vendor;
                  const isActive  = profile?.active_role === role;
                  const saving    = savingRole === role;
                  return (
                    <button key={role} disabled={saving}
                      onClick={() => {
                        if (saving) return;
                        if (available) handleSwitch(role);
                        else router.push(role === 'couple' ? '/couple/onboarding' : '/vendor/onboarding');
                      }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
                        borderRadius: 14, border: `1.5px solid ${isActive ? C.crimson : available ? C.border : 'rgba(154,33,67,0.2)'}`,
                        background: isActive ? C.crimsonDim : available ? '#fff' : 'rgba(154,33,67,0.04)',
                        cursor: saving ? 'default' : 'pointer', transition: 'all 0.15s',
                      }}>
                      <div style={{ width: 38, height: 38, borderRadius: 11, background: isActive ? C.crimsonDim : C.goldDim, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                        {role === 'vendor' ? '🏢' : '💍'}
                      </div>
                      <div style={{ flex: 1, textAlign: 'left' }}>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: isActive ? C.crimson : C.text }}>
                          {role === 'vendor' ? 'Vendor mode' : 'Couple mode'}
                        </p>
                        <p style={{ margin: '2px 0 0', fontSize: 11, color: C.muted }}>
                          {available
                            ? (role === 'vendor' ? 'Manage your business & services' : 'Plan your wedding & manage tasks')
                            : (role === 'couple' ? 'Tap to set up your couple account' : 'Tap to set up your vendor account')}
                        </p>
                      </div>
                      <div>
                        {saving ? (
                          <div style={{ width: 20, height: 20, border: `2px solid ${C.crimsonDim}`, borderTopColor: C.crimson, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                        ) : isActive ? (
                          <span style={{ fontSize: 11, fontWeight: 700, color: C.crimson, background: C.crimsonDim, border: `1px solid ${C.crimsonGlow}`, borderRadius: 20, padding: '3px 10px' }}>Active</span>
                        ) : available ? (
                          <svg width="14" height="14" fill="none" stroke={C.muted} strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                        ) : (
                          <span style={{ fontSize: 11, fontWeight: 700, color: C.crimson, background: C.crimsonDim, border: `1px solid rgba(154,33,67,0.2)`, borderRadius: 20, padding: '3px 10px' }}>Set up →</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </Section>

          {/* Notifications */}
          <Section title="Notifications" icon="🔔">
            <Row
              icon={<svg width="17" height="17" fill="none" stroke={C.crimson} strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>}
              label="In-App Notifications"
              sub="Quote requests, messages, bookings"
              right={
                <Toggle on={notificationsEnabled} disabled={notifLoading} onChange={async () => {
                  const next = !notificationsEnabled;
                  setNotificationsEnabled(next);
                  if (authUserId) {
                    await supabase.from('user_preferences').upsert({ user_id: authUserId, in_app_notifications: next, updated_at: new Date().toISOString() });
                  }
                }} />
              }
            />
            <div style={{ padding: '0 18px 4px', borderBottom: `1px solid ${C.border}` }}>
              <PushNotificationsToggle />
            </div>
          </Section>

          {/* Preferences */}
          <Section title="Preferences" icon="⚙️">
            <Row
              icon={<svg width="17" height="17" fill="none" stroke={C.crimson} strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 1.343-3 3s1.343 3 3 3 3 1.343 3 3-1.343 3-3 3m0-12v1m0 16v1m7.071-14.071l-.707.707M6.343 17.657l-.707.707M20 12h-1M5 12H4M17.657 6.343l-.707.707M6.343 6.343l-.707.707" /></svg>}
              label="Currency"
              sub="How prices display across the app"
              last
              right={
                <select value={currency} onChange={async e => {
                  const next = e.target.value;
                  setCurrency(next as any);
                  if (authUserId) {
                    await supabase.from('user_preferences').upsert({ user_id: authUserId, currency: next, updated_at: new Date().toISOString() });
                  }
                }}
                  style={{ padding: '6px 10px', borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 12, fontWeight: 700, color: C.text, background: '#fdfaf8', outline: 'none', fontFamily: "'DM Sans', system-ui", cursor: 'pointer' }}>
                  <option value="ZAR">R (ZAR)</option>
                  <option value="USD">$ (USD)</option>
                  <option value="BWP">P (BWP)</option>
                </select>
              }
            />
          </Section>

          {/* Support */}
          <Section title="Support" icon="💬">
            {[
              { label: 'Help / FAQ', sub: 'Guides and common questions', href: '/help', icon: <svg width="17" height="17" fill="none" stroke={C.crimson} strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
              { label: 'Contact Support', sub: 'Email our support team', href: '/support/contact', icon: <svg width="17" height="17" fill="none" stroke={C.crimson} strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg> },
              { label: 'Report a Problem', sub: 'Something not working?', href: '/support/report', icon: <svg width="17" height="17" fill="none" stroke={C.crimson} strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg> },
            ].map((item, i, arr) => (
              <Row key={item.label} icon={item.icon} label={item.label} sub={item.sub} onClick={() => router.push(item.href)} last={i === arr.length - 1} />
            ))}
          </Section>

          {/* Legal */}
          <Section title="Legal" icon="📜">
            {[
              { label: 'Terms of Service', href: '/legal/terms', icon: <svg width="17" height="17" fill="none" stroke={C.crimson} strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> },
              { label: 'Privacy Policy', href: '/legal/privacy', icon: <svg width="17" height="17" fill="none" stroke={C.crimson} strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg> },
            ].map((item, i, arr) => (
              <Row key={item.label} icon={item.icon} label={item.label} onClick={() => router.push(item.href)} last={i === arr.length - 1} />
            ))}
          </Section>

          {/* Account */}
          <Section title="Account" icon="👤">
            <Row
              icon={<svg width="17" height="17" fill="none" stroke={C.crimson} strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>}
              label="Change Password"
              sub={pwResetMsg ? pwResetMsg.text : 'Send a reset link to your email'}
              onClick={handleChangePassword}
            />
            <Row
              icon={<svg width="17" height="17" fill="none" stroke={C.crimson} strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>}
              label="Change Email"
              sub={authEmail ?? 'Update your email address'}
              onClick={() => { setShowChangeEmail(true); setEmailChangeMsg(null); setNewEmail(''); }}
            />
            <Row
              icon={<svg width="17" height="17" fill="none" stroke={C.error} strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>}
              label="Sign Out"
              danger
              onClick={handleSignOut}
            />
            <Row
              last
              icon={<svg width="17" height="17" fill="none" stroke={C.error} strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>}
              label="Delete Account"
              sub="Permanently removes your account and all data"
              danger
              onClick={handleDeleteAccount}
            />
          </Section>

          {/* Footer */}
          <div style={{ textAlign: 'center', padding: '12px 0 4px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: C.gold }} />
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: C.crimson, fontFamily: 'Georgia, serif', letterSpacing: 0.4 }}>uMshado</p>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: C.gold }} />
            </div>
            <p style={{ margin: 0, fontSize: 10, color: C.muted }}>Version 1.0.0 · Made with ❤️ in South Africa</p>
          </div>
        </div>
      </div>

      <VendorBottomNav />

      {/* ═══════════ EDIT BUSINESS PROFILE SHEET ═══════════ */}
      {showEditProfile && (
        <>
          <div onClick={() => { setShowEditProfile(false); setProfileSaveMsg(null); }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(26,13,18,0.55)', zIndex: 40, animation: 'fadeIn 0.2s ease' }} />

          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0,
            background: C.card, borderRadius: '24px 24px 0 0', zIndex: 50,
            animation: 'sheetUp 0.3s cubic-bezier(.32,.72,0,1)',
            padding: '0 0 env(safe-area-inset-bottom)',
            maxWidth: 560, margin: '0 auto',
            maxHeight: '92svh', overflowY: 'auto',
          }}>
            <div style={{ width: 40, height: 4, background: C.crimsonDim, borderRadius: 2, margin: '14px auto 0' }} />

            <div style={{ padding: '20px 20px 32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: C.text, fontFamily: 'Georgia, serif' }}>Edit Business Profile</h2>
                  <p style={{ margin: '3px 0 0', fontSize: 11, color: C.muted }}>Update your public business details</p>
                </div>
                <button onClick={() => { setShowEditProfile(false); setProfileSaveMsg(null); }}
                  style={{ width: 32, height: 32, borderRadius: '50%', border: `1.5px solid ${C.border}`, background: C.bg, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="12" height="12" fill="none" stroke={C.muted} strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              {profileSaveMsg && (
                <div style={{ marginBottom: 18, padding: '11px 14px', borderRadius: 12, fontSize: 13, fontWeight: 600, background: profileSaveMsg.type === 'success' ? C.successDim : C.errorDim, color: profileSaveMsg.type === 'success' ? C.success : C.error, border: `1.5px solid ${profileSaveMsg.type === 'success' ? 'rgba(30,124,74,0.25)' : 'rgba(192,50,42,0.2)'}` }}>
                  {profileSaveMsg.type === 'success' ? '✓ ' : '⚠ '}{profileSaveMsg.text}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <Field label="Business Name" required>
                  <input value={businessName} onChange={e => setBusinessName(e.target.value)}
                    placeholder="e.g., Noxa Events & Coordination"
                    style={inputStyle} />
                </Field>

                <Field label="Category">
                  <select value={category} onChange={e => setCategory(e.target.value)}
                    style={{ ...inputStyle, cursor: 'pointer' }}>
                    <option value="">Select a category…</option>
                    {LOCKED_CATEGORIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </Field>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Field label="City">
                    <input value={city} onChange={e => setCity(e.target.value)}
                      placeholder="e.g., Johannesburg"
                      style={inputStyle} />
                  </Field>
                  <Field label="Country">
                    <select value={country} onChange={e => {
                      const selected = AFRICAN_COUNTRIES.find(c => c.name === e.target.value);
                      setCountry(e.target.value);
                      setCountryCode(selected?.code ?? '');
                    }} style={{ ...inputStyle, cursor: 'pointer' }}>
                      <option value="">Select…</option>
                      {AFRICAN_COUNTRIES.map(c => (
                        <option key={c.code} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </Field>
                </div>

                <Field label="Business Description">
                  <textarea value={description} onChange={e => setDescription(e.target.value)}
                    placeholder="Tell couples what makes your business special…"
                    rows={4}
                    style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.55 }} />
                </Field>

                <button onClick={saveProfile} disabled={profileSaving}
                  style={{
                    padding: '13px', borderRadius: 14, border: 'none',
                    background: profileSaving ? '#d4b8c4' : `linear-gradient(135deg,${C.crimson},${C.crimsonDark})`,
                    color: '#fff', fontSize: 14, fontWeight: 800, cursor: profileSaving ? 'default' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    boxShadow: profileSaving ? 'none' : '0 4px 16px rgba(154,33,67,0.3)',
                  }}>
                  {profileSaving && <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />}
                  {profileSaving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ═══════════ CHANGE EMAIL SHEET ═══════════ */}
      {showChangeEmail && (
        <>
          <div onClick={() => { setShowChangeEmail(false); setEmailChangeMsg(null); }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(26,13,18,0.55)', zIndex: 40, animation: 'fadeIn 0.2s ease' }} />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0,
            background: C.card, borderRadius: '24px 24px 0 0', zIndex: 50,
            animation: 'sheetUp 0.3s cubic-bezier(.32,.72,0,1)',
            padding: '0 20px env(safe-area-inset-bottom)',
            maxWidth: 560, margin: '0 auto',
          }}>
            <div style={{ width: 40, height: 4, background: C.crimsonDim, borderRadius: 2, margin: '14px auto' }} />
            <h2 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 800, color: C.text, fontFamily: 'Georgia, serif' }}>Change Email</h2>
            <p style={{ margin: '0 0 18px', fontSize: 12, color: C.muted }}>Current: {authEmail}</p>
            {emailChangeMsg && (
              <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: emailChangeMsg.type === 'success' ? C.successDim : C.errorDim, color: emailChangeMsg.type === 'success' ? C.success : C.error }}>
                {emailChangeMsg.text}
              </div>
            )}
            <input value={newEmail} onChange={e => setNewEmail(e.target.value)}
              placeholder="New email address" type="email"
              style={{ ...inputStyle, marginBottom: 12 }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, paddingBottom: 24 }}>
              <button onClick={() => { setShowChangeEmail(false); setEmailChangeMsg(null); }}
                style={{ padding: '12px', borderRadius: 12, border: `1.5px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleChangeEmail} disabled={emailChangeSaving}
                style={{ padding: '12px', borderRadius: 12, border: 'none', background: `linear-gradient(135deg,${C.crimson},${C.crimsonDark})`, color: '#fff', fontSize: 13, fontWeight: 800, cursor: emailChangeSaving ? 'default' : 'pointer', opacity: emailChangeSaving ? 0.7 : 1 }}>
                {emailChangeSaving ? 'Saving…' : 'Update'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function VendorSettingsPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100svh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--um-ivory)' }}>
        <div style={{ width: 28, height: 28, border: '3px solid rgba(154,33,67,0.15)', borderTopColor: 'var(--um-crimson)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    }>
      <VendorSettingsContent />
    </Suspense>
  );
}
