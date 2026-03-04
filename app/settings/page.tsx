'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import BottomNav from '@/components/BottomNav';
import { UmshadoIcon } from '@/components/ui/UmshadoLogo';
import { useCurrency } from '@/app/providers/CurrencyProvider';

function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const target = useMemo(() => searchParams?.get('target'), [searchParams]);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [darkModeEnabled, setDarkModeEnabled] = useState(false);
  const [language, setLanguage] = useState('English');
  const [loadingRole, setLoadingRole] = useState(true);
  const [savingRole, setSavingRole] = useState<'couple' | 'vendor' | null>(null);
  const [profile, setProfile] = useState<{
    has_couple?: boolean | null;
    has_vendor?: boolean | null;
    active_role?: 'couple' | 'vendor' | null;
  } | null>(null);

  // Real user data from Supabase auth
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [authUserId, setAuthUserId] = useState<string | null>(null);

  // ── Edit Profile state ─────────────────────────────────
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editYourName, setEditYourName] = useState('');
  const [editPartnerName, setEditPartnerName] = useState('');
  const [editWeddingDate, setEditWeddingDate] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editCountry, setEditCountry] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaveMsg, setProfileSaveMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Avatar
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Notification pref (persisted to user_preferences)
  const [notifLoading, setNotifLoading] = useState(true);

  // ── Couple profile from DB ─────────────────────────────
  const [coupleWeddingDate, setCoupleWeddingDate] = useState<string | null>(null);
  const [couplePartnerName, setCouplePartnerName] = useState<string | null>(null);

  // Currency from client-side provider (localStorage)
  const { currency, setCurrency } = useCurrency();

  useEffect(() => {
    (async () => {
      setLoadingRole(true);
      try {
        const { data: userData } = await supabase.auth.getUser();
        const user = (userData as any)?.user || null;
        if (!user?.id) {
          setProfile(null);
          return;
        }
        setAuthEmail(user.email ?? null);
        setAuthUserId(user.id);

        const { data } = await supabase
          .from('profiles')
          .select('has_couple,has_vendor,active_role,full_name')
          .eq('id', user.id)
          .maybeSingle();

        let hasCouple = data?.has_couple ?? null;
        let hasVendor = data?.has_vendor ?? null;

        if (hasCouple === null || hasVendor === null) {
          const [coupleRes, vendorRes] = await Promise.all([
            supabase.from('couples').select('id').eq('id', user.id).maybeSingle(),
            supabase.from('vendors').select('id').eq('id', user.id).maybeSingle()
          ]);
          hasCouple = hasCouple ?? !!coupleRes.data;
          hasVendor = hasVendor ?? !!vendorRes.data;

          await supabase
            .from('profiles')
            .update({ has_couple: hasCouple, has_vendor: hasVendor })
            .eq('id', user.id);
        }

        setProfile({
          has_couple: hasCouple,
          has_vendor: hasVendor,
          active_role: data?.active_role ?? null
        });

        // Pre-fill "Your Name" from profiles.full_name
        if (data?.full_name) {
          setEditYourName(data.full_name);
        }

        // Load notification preference
        const { data: prefData } = await supabase
          .from('user_preferences')
          .select('in_app_notifications')
          .eq('user_id', user.id)
          .maybeSingle();
        if (prefData !== null && prefData !== undefined) {
          setNotificationsEnabled(prefData.in_app_notifications ?? true);
        }
        setNotifLoading(false);

        // Load couple profile for display + edit
        if (hasCouple) {
          const { data: coupleData } = await supabase
            .from('couples')
            .select('partner_name, wedding_date, location, country, avatar_url')
            .eq('id', user.id)
            .maybeSingle();
          if (coupleData) {
            setCouplePartnerName(coupleData.partner_name ?? null);
            setCoupleWeddingDate(coupleData.wedding_date ?? null);
            setEditPartnerName(coupleData.partner_name ?? '');
            setEditWeddingDate(coupleData.wedding_date ?? '');
            setEditLocation(coupleData.location ?? '');
            setEditCountry(coupleData.country ?? '');
            setAvatarUrl(coupleData.avatar_url ?? null);
          }
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
        console.error(err);
      } finally {
        setLoadingRole(false);
      }
    })();
  }, []);

  const handleSwitch = async (role: 'couple' | 'vendor') => {
    if (!profile) return;
    setSavingRole(role);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const user = (userData as any)?.user || null;
      if (!user?.id) {
        router.push('/auth/sign-in');
        return;
      }

      const { error } = await supabase
        .from('profiles')
        .update({ active_role: role })
        .eq('id', user.id);

      if (error) {
        console.error('Failed to switch role:', error);
        alert('Unable to switch role. Please try again.');
        return;
      }

      router.push(role === 'couple' ? '/couple/dashboard' : '/vendor/dashboard');
    } catch (err) {
      console.error(err);
      alert('Unable to switch role. Please try again.');
    } finally {
      setSavingRole(null);
    }
  };

  // ── Avatar upload handler ──────────────────────────────
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !authUserId) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be under 5MB');
      return;
    }
    setUploadingAvatar(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${authUserId}/avatar.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('couple-avatars')
        .upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage
        .from('couple-avatars')
        .getPublicUrl(path);
      const publicUrl = urlData.publicUrl;
      await supabase.from('couples').upsert({ id: authUserId, avatar_url: publicUrl });
      setAvatarUrl(publicUrl);
    } catch (err) {
      console.error('Avatar upload failed:', err);
    } finally {
      setUploadingAvatar(false);
    }
  };

  // ── Edit Profile handlers ──────────────────────────────
  const openEditProfile = () => {
    setProfileSaveMsg(null);
    setShowEditProfile(true);
  };

  const saveProfile = async () => {
    if (!authUserId) return;

    // Validate wedding date is not in the past
    if (editWeddingDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const selected = new Date(editWeddingDate + 'T00:00:00');
      if (selected < today) {
        setProfileSaveMsg({ type: 'error', text: 'Wedding date cannot be in the past.' });
        return;
      }
    }

    setProfileSaving(true);
    setProfileSaveMsg(null);

    // Save your own name to profiles table
    const { error: nameError } = await supabase
      .from('profiles')
      .update({ full_name: editYourName.trim() || null })
      .eq('id', authUserId);
    if (nameError) console.error('Failed to save name:', nameError);

    const payload: Record<string, unknown> = {
      id: authUserId,
      partner_name: editPartnerName.trim() || null,
      wedding_date: editWeddingDate || null,
      location: editLocation.trim() || null,
      country: editCountry.trim() || null,
    };

    const { error } = await supabase.from('couples').upsert(payload);
    if (error) {
      console.error('Failed to save profile:', error);
      setProfileSaveMsg({ type: 'error', text: 'Failed to save. Please try again.' });
    } else {
      setCouplePartnerName(editPartnerName.trim() || null);
      setCoupleWeddingDate(editWeddingDate || null);
      setProfileSaveMsg({ type: 'success', text: 'Profile updated successfully!' });
      // Auto-close after a moment
      setTimeout(() => { setShowEditProfile(false); setProfileSaveMsg(null); }, 1500);
    }
    setProfileSaving(false);
  };

  const handleSignOut = async () => {
    if (!confirm('Are you sure you want to sign out?')) return;
    await supabase.auth.signOut();
    router.push('/auth/sign-in');
  };

  // ── Today's date for min validation ────────────────────
  const todayStr = new Date().toISOString().split('T')[0];

  const supportItems = [
    {
      id: 1,
      label: 'Help / FAQ',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      action: () => router.push('/help')
    },
    {
      id: 2,
      label: 'Contact Support',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      action: () => router.push('/support/contact')
    },
    {
      id: 3,
      label: 'Report a Problem',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
      action: () => router.push('/support/report')
    }
  ];

  const legalItems = [
    {
      id: 1,
      label: 'Terms of Service',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      action: () => router.push('/legal/terms')
    },
    {
      id: 2,
      label: 'Privacy Policy',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      ),
      action: () => router.push('/legal/privacy')
    }
  ];

  /* ── Inline style helpers for dark-mode-safe colours ── */
  const S = {
    page:        { background:'var(--background)', minHeight:'100svh' } as React.CSSProperties,
    hdr:         { background:'var(--surface)', borderBottom:'1px solid var(--border-subtle)', padding:'16px 20px' } as React.CSSProperties,
    hdrTitle:    { margin:0, fontSize:20, fontWeight:700, color:'var(--foreground)', fontFamily:'var(--font-display,Georgia,serif)' } as React.CSSProperties,
    hdrSub:      { margin:'2px 0 0', fontSize:13, color:'var(--muted)' } as React.CSSProperties,
    card:        { background:'var(--surface)', borderRadius:18, border:'1.5px solid var(--border-subtle)', overflow:'hidden' as const, boxShadow:'0 2px 12px rgba(0,0,0,0.06)' } as React.CSSProperties,
    cardHdr:     { padding:'12px 16px', borderBottom:'1px solid var(--border-subtle)', background:'var(--surface-raised)' } as React.CSSProperties,
    cardHdrTxt:  { margin:0, fontSize:12, fontWeight:700, color:'var(--muted)', letterSpacing:'0.8px', textTransform:'uppercase' as const } as React.CSSProperties,
    row:         { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', borderBottom:'1px solid var(--border-subtle)' } as React.CSSProperties,
    rowLast:     { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px' } as React.CSSProperties,
    rowLeft:     { display:'flex', alignItems:'center', gap:12, flex:1, minWidth:0 } as React.CSSProperties,
    iconBox:     (bg: string) => ({ width:40, height:40, borderRadius:12, background:bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }) as React.CSSProperties,
    rowTitle:    { margin:'0 0 1px', fontSize:14, fontWeight:600, color:'var(--foreground)' } as React.CSSProperties,
    rowSub:      { margin:0, fontSize:12, color:'var(--muted)' } as React.CSSProperties,
    chevron:     { color:'var(--muted)', opacity:0.5 } as React.CSSProperties,
    select:      { padding:'7px 12px', borderRadius:10, border:'1.5px solid var(--border)', background:'var(--surface-raised)', color:'var(--foreground)', fontSize:13, fontWeight:600, outline:'none', cursor:'pointer' } as React.CSSProperties,
    label:       { display:'block', fontSize:12, fontWeight:700, color:'var(--muted)', letterSpacing:'0.8px', textTransform:'uppercase' as const, marginBottom:8 } as React.CSSProperties,
    input:       { width:'100%', height:48, padding:'0 14px', borderRadius:12, border:'1.5px solid var(--border)', background:'var(--surface)', color:'var(--foreground)', fontSize:15, outline:'none', boxSizing:'border-box' as const, fontFamily:'var(--font-body,sans-serif)' } as React.CSSProperties,
    modalBg:     { position:'fixed' as const, inset:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'flex-end', justifyContent:'center', zIndex:50 } as React.CSSProperties,
    modal:       { background:'var(--surface)', borderRadius:'24px 24px 0 0', width:'100%', maxWidth:520, padding:'0 24px 44px', maxHeight:'90vh', overflowY:'auto' as const, boxShadow:'0 -8px 40px rgba(0,0,0,0.25)' } as React.CSSProperties,
  };

  const Toggle = ({ on, onToggle, disabled = false }: { on: boolean; onToggle: () => void; disabled?: boolean }) => (
    <button onClick={onToggle} disabled={disabled}
      style={{ width:50, height:28, borderRadius:14, border:'none', cursor:'pointer', transition:'background 0.2s', flexShrink:0,
        background: on ? 'var(--um-gold)' : 'rgba(120,120,130,0.3)', position:'relative', padding:0 }}>
      <span style={{ position:'absolute', top:3, left: on ? 25 : 3, width:22, height:22, borderRadius:'50%', background:'#fff', transition:'left 0.2s', boxShadow:'0 1px 4px rgba(0,0,0,0.25)' }} />
    </button>
  );

  return (
    <div style={S.page}>
      <div style={{ maxWidth:900, margin:'0 auto', paddingBottom:100 }}>
        {/* Header */}
        <div style={S.hdr}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <UmshadoIcon size={28} />
            <div>
              <h1 style={S.hdrTitle}>Settings</h1>
              <p style={S.hdrSub}>Manage your account and preferences</p>
            </div>
          </div>
        </div>

        <div style={{ padding:'16px 16px', display:'flex', flexDirection:'column', gap:14 }}>
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handleAvatarUpload} />

          {/* ── Profile hero card ── */}
          <div style={{ background:'linear-gradient(135deg,#2c1a0e,#4a2e14)', borderRadius:20, padding:'20px', overflow:'hidden', position:'relative', boxShadow:'0 4px 20px rgba(0,0,0,0.25)' }}>
            <div style={{ position:'absolute', top:-30, right:-30, width:130, height:130, borderRadius:'50%', background:'rgba(184,151,62,0.1)', pointerEvents:'none' }} />
            <div style={{ display:'flex', alignItems:'center', gap:16 }}>
              {/* Avatar */}
              <button onClick={() => fileInputRef.current?.click()} disabled={uploadingAvatar}
                style={{ width:80, height:80, borderRadius:'50%', overflow:'hidden', border:'3px solid rgba(184,151,62,0.5)', flexShrink:0, cursor:'pointer', background:'rgba(255,255,255,0.08)', position:'relative' }}>
                {uploadingAvatar
                  ? <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center' }}><div style={{ width:24, height:24, borderRadius:'50%', border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'#fff', animation:'um-spin 0.7s linear infinite' }}/></div>
                  : avatarUrl
                    ? <img src={avatarUrl} alt="Profile" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                    : <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', width:'100%', height:'100%', gap:4 }}>
                        <span style={{ fontSize:28 }}>👤</span>
                        <span style={{ fontSize:7, color:'rgba(255,255,255,0.4)', letterSpacing:0.5 }}>ADD PHOTO</span>
                      </div>
                }
                <div style={{ position:'absolute', bottom:2, right:2, width:22, height:22, borderRadius:'50%', background:'linear-gradient(135deg,#b8973e,#8a6010)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <svg width="10" height="10" fill="none" stroke="#fff" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                </div>
              </button>
              <div style={{ flex:1, minWidth:0 }}>
                <h2 style={{ margin:'0 0 3px', fontSize:17, fontWeight:700, color:'#fff', fontFamily:'var(--font-display,Georgia,serif)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {editYourName && couplePartnerName ? `${editYourName} & ${couplePartnerName}` : editYourName || couplePartnerName || 'Set your names'}
                </h2>
                {authEmail && <p style={{ margin:'0 0 2px', fontSize:12, color:'rgba(255,255,255,0.55)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{authEmail}</p>}
                {coupleWeddingDate && <p style={{ margin:0, fontSize:11, color:'rgba(255,255,255,0.45)' }}>📅 {new Date(coupleWeddingDate + 'T00:00:00').toLocaleDateString('en-ZA', { day:'numeric', month:'long', year:'numeric' })}</p>}
              </div>
            </div>
            <button onClick={openEditProfile}
              style={{ width:'100%', marginTop:14, padding:'10px', borderRadius:12, border:'1px solid rgba(184,151,62,0.3)', background:'rgba(184,151,62,0.12)', color:'rgba(255,255,255,0.85)', fontSize:13, fontWeight:600, cursor:'pointer' }}>
              ✏️ Edit Profile
            </button>
          </div>

          {/* ── Switch Account ── */}
          <div style={S.card}>
            <div style={S.cardHdr}>
              <p style={S.cardHdrTxt}>Switch Account</p>
              {target && <p style={{ margin:'4px 0 0', fontSize:12, color:'var(--muted)' }}>You tried to open {target === 'vendor' ? 'Vendor' : 'Couple'} pages.</p>}
              {profile?.active_role && <p style={{ margin:'4px 0 0', fontSize:12, color:'var(--muted)' }}>Active: {profile.active_role === 'vendor' ? 'Vendor' : 'Couple'}</p>}
            </div>
            <div style={{ padding:14, display:'flex', flexDirection:'column', gap:10 }}>
              {loadingRole ? (
                <p style={{ margin:0, fontSize:13, color:'var(--muted)' }}>Loading roles…</p>
              ) : (
                <>
                  {(['couple','vendor'] as const).map(role => {
                    const has = role === 'couple' ? profile?.has_couple : profile?.has_vendor;
                    return (
                      <button key={role} disabled={!has || savingRole !== null} onClick={() => handleSwitch(role)}
                        style={{ width:'100%', textAlign:'left', borderRadius:14, border:`1.5px solid ${has ? 'rgba(184,151,62,0.3)' : 'var(--border-subtle)'}`, padding:'14px 16px', background: has ? 'var(--surface-raised)' : 'transparent', cursor: has ? 'pointer' : 'not-allowed', opacity: has ? 1 : 0.45, transition:'all 0.15s' }}>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                          <div>
                            <p style={{ margin:'0 0 2px', fontSize:14, fontWeight:700, color:'var(--foreground)' }}>{role === 'couple' ? '💍 Couple mode' : '🏪 Vendor mode'}</p>
                            <p style={{ margin:0, fontSize:12, color:'var(--muted)' }}>{role === 'couple' ? 'Plan your wedding and manage tasks' : 'Manage your business and services'}</p>
                          </div>
                          <span style={{ fontSize:10, fontWeight:700, padding:'3px 10px', borderRadius:20, flexShrink:0, marginLeft:10, background: has ? 'rgba(184,151,62,0.12)' : 'var(--surface-raised)', color: has ? 'var(--um-gold)' : 'var(--muted)' }}>
                            {has ? 'Available' : 'Not set up'}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          </div>

          {/* ── App Preferences ── */}
          <div style={S.card}>
            <div style={S.cardHdr}><p style={S.cardHdrTxt}>App Preferences</p></div>

            {/* Notifications */}
            <div style={S.row}>
              <div style={S.rowLeft}>
                <div style={S.iconBox('rgba(26,106,168,0.12)')}>
                  <svg width="18" height="18" fill="none" stroke="#3a8ed4" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
                </div>
                <div>
                  <p style={S.rowTitle}>In-App Notifications</p>
                  <p style={S.rowSub}>Quote updates, messages, bookings</p>
                </div>
              </div>
              <Toggle on={notificationsEnabled} disabled={notifLoading} onToggle={async () => {
                const next = !notificationsEnabled;
                setNotificationsEnabled(next);
                if (authUserId) await supabase.from('user_preferences').upsert({ user_id: authUserId, in_app_notifications: next, updated_at: new Date().toISOString() });
              }} />
            </div>

            {/* Dark Mode */}
            <div style={S.row}>
              <div style={S.rowLeft}>
                <div style={S.iconBox('rgba(255,200,50,0.1)')}>
                  <svg width="18" height="18" fill="none" stroke="#c9a84c" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>
                </div>
                <div>
                  <p style={S.rowTitle}>Dark Mode</p>
                  <p style={S.rowSub}>Easier on the eyes at night</p>
                </div>
              </div>
              <Toggle on={darkModeEnabled} onToggle={() => setDarkModeEnabled(!darkModeEnabled)} />
            </div>

            {/* Language */}
            <div style={S.row}>
              <div style={S.rowLeft}>
                <div style={S.iconBox('rgba(45,122,79,0.12)')}>
                  <svg width="18" height="18" fill="none" stroke="#3d9e6a" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"/></svg>
                </div>
                <div>
                  <p style={S.rowTitle}>Language</p>
                  <p style={S.rowSub}>Choose your preferred language</p>
                </div>
              </div>
              <select value={language} onChange={e => setLanguage(e.target.value)} style={S.select}>
                <option value="English">English</option>
                <option value="Zulu">Zulu</option>
                <option value="Xhosa">Xhosa</option>
                <option value="Afrikaans">Afrikaans</option>
                <option value="Sotho">Sotho</option>
              </select>
            </div>

            {/* Currency */}
            <div style={S.rowLast}>
              <div style={S.rowLeft}>
                <div style={S.iconBox('rgba(184,151,62,0.12)')}>
                  <svg width="18" height="18" fill="none" stroke="var(--um-gold)" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 1.343-3 3s1.343 3 3 3 3 1.343 3 3-1.343 3-3 3m0-18v2m0 18v2"/></svg>
                </div>
                <div>
                  <p style={S.rowTitle}>Currency</p>
                  <p style={S.rowSub}>How prices are displayed</p>
                </div>
              </div>
              <select value={currency} onChange={async e => {
                const next = e.target.value; setCurrency(next as any);
                try { if (authUserId) await supabase.from('user_preferences').upsert({ user_id: authUserId, currency: next, updated_at: new Date().toISOString() }); } catch {}
              }} style={S.select}>
                <option value="ZAR">R (ZAR)</option>
                <option value="USD">$ (USD)</option>
                <option value="BWP">P (BWP)</option>
              </select>
            </div>
          </div>

          {/* ── Support ── */}
          <div style={S.card}>
            <div style={S.cardHdr}><p style={S.cardHdrTxt}>Support</p></div>
            {supportItems.map((item, i) => (
              <button key={item.id} onClick={item.action}
                style={{ ...( i < supportItems.length - 1 ? S.row : S.rowLast), width:'100%', cursor:'pointer', background:'transparent', border:'none' }}>
                <div style={S.rowLeft}>
                  <div style={{ color:'var(--muted)' }}>{item.icon}</div>
                  <span style={{ fontSize:14, fontWeight:600, color:'var(--foreground)' }}>{item.label}</span>
                </div>
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" style={S.chevron}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
              </button>
            ))}
          </div>

          {/* ── Legal ── */}
          <div style={S.card}>
            <div style={S.cardHdr}><p style={S.cardHdrTxt}>Legal</p></div>
            {legalItems.map((item, i) => (
              <button key={item.id} onClick={item.action}
                style={{ ...( i < legalItems.length - 1 ? S.row : S.rowLast), width:'100%', cursor:'pointer', background:'transparent', border:'none' }}>
                <div style={S.rowLeft}>
                  <div style={{ color:'var(--muted)' }}>{item.icon}</div>
                  <span style={{ fontSize:14, fontWeight:600, color:'var(--foreground)' }}>{item.label}</span>
                </div>
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" style={S.chevron}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
              </button>
            ))}
          </div>

          {/* ── Account ── */}
          <div style={S.card}>
            <div style={S.cardHdr}><p style={S.cardHdrTxt}>Account</p></div>
            <button onClick={handleSignOut}
              style={{ width:'100%', padding:'16px', display:'flex', alignItems:'center', gap:12, background:'transparent', border:'none', cursor:'pointer' }}>
              <div style={{ width:40, height:40, borderRadius:12, background:'rgba(224,68,68,0.1)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <svg width="18" height="18" fill="none" stroke="#e04444" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
              </div>
              <span style={{ fontSize:14, fontWeight:700, color:'#e04444' }}>Sign Out</span>
            </button>
          </div>

          {/* App info */}
          <div style={{ textAlign:'center', padding:'12px 0 4px' }}>
            <p style={{ margin:'0 0 2px', fontSize:12, color:'var(--muted)' }}>uMshado App</p>
            <p style={{ margin:0, fontSize:11, color:'var(--muted)', opacity:0.6 }}>Made with ❤️ in South Africa</p>
          </div>
        </div>
      </div>

      {/* ── Edit Profile Modal ── */}
      {showEditProfile && (
        <div style={S.modalBg}>
          <div style={S.modal}>
            <div style={{ width:40, height:4, borderRadius:2, background:'var(--border)', margin:'16px auto 22px' }} />
            <h3 style={{ margin:'0 0 20px', fontSize:19, fontWeight:700, color:'var(--foreground)', fontFamily:'var(--font-display,Georgia,serif)' }}>Edit Profile</h3>

            {profileSaveMsg && (
              <div style={{ marginBottom:16, padding:'12px 16px', borderRadius:12, fontSize:13, fontWeight:600, background: profileSaveMsg.type === 'success' ? 'rgba(45,122,79,0.12)' : 'rgba(224,68,68,0.1)', color: profileSaveMsg.type === 'success' ? '#3d9e6a' : '#e04444', border:`1px solid ${profileSaveMsg.type === 'success' ? 'rgba(45,122,79,0.2)' : 'rgba(224,68,68,0.2)'}` }}>
                {profileSaveMsg.text}
              </div>
            )}

            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              {[
                { label:'Your Name', val:editYourName, set:setEditYourName, ph:'e.g., Mthabisi', type:'text' },
                { label:"Partner's Name", val:editPartnerName, set:setEditPartnerName, ph:'e.g., Mafuyane', type:'text' },
                { label:'Wedding Date *', val:editWeddingDate, set:(v:string) => { setEditWeddingDate(v); setProfileSaveMsg(null); }, ph:'', type:'date' },
                { label:'Wedding Location', val:editLocation, set:setEditLocation, ph:'e.g., Johannesburg, Sandton', type:'text' },
                { label:'Country', val:editCountry, set:setEditCountry, ph:'e.g., South Africa', type:'text' },
              ].map(f => (
                <div key={f.label}>
                  <label style={S.label}>{f.label}</label>
                  <input type={f.type} value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.ph}
                    {...(f.type === 'date' ? { min: todayStr } : {})}
                    style={S.input} />
                </div>
              ))}
            </div>

            <div style={{ display:'flex', gap:10, marginTop:24 }}>
              <button onClick={() => { setShowEditProfile(false); setProfileSaveMsg(null); }}
                style={{ flex:1, height:48, borderRadius:14, border:'1.5px solid var(--border)', background:'var(--surface-raised)', fontSize:14, fontWeight:600, color:'var(--muted)', cursor:'pointer' }}>
                Cancel
              </button>
              <button onClick={saveProfile} disabled={profileSaving}
                style={{ flex:2, height:48, borderRadius:14, border:'none', background:'linear-gradient(135deg,#b8973e,#8a6010)', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', boxShadow:'0 4px 16px rgba(184,151,62,0.35)', opacity:profileSaving ? 0.7 : 1 }}>
                {profileSaving ? 'Saving…' : '✓ Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
      <style>{'@keyframes um-spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight:'100svh', background:'var(--background)', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ width:38, height:38, borderRadius:'50%', border:'3px solid rgba(184,151,62,0.15)', borderTopColor:'var(--um-gold)', animation:'um-spin 0.8s linear infinite' }}/>
        <style>{'@keyframes um-spin{to{transform:rotate(360deg)}}'}</style>
      </div>
    }>
      <SettingsContent />
    </Suspense>
  );
}
