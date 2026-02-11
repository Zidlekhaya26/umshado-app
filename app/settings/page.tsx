'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import BottomNav from '@/components/BottomNav';
import { UmshadoIcon } from '@/components/ui/UmshadoLogo';

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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile-first container wrapper */}
      <div className="w-full max-w-screen-xl mx-auto min-h-screen bg-white shadow-lg flex flex-col pb-24 px-4">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-4 py-5">
          <div className="flex items-center gap-3">
            <UmshadoIcon size={28} />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Settings</h1>
              <p className="text-sm text-gray-600 mt-0.5">Manage your account and preferences</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Hidden file input */}
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />

          {/* Profile Card */}
          <div className="bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl p-5 text-white shadow-lg">
            <div className="flex items-center gap-4">
              {/* Avatar upload circle */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="relative w-28 h-28 rounded-full overflow-hidden flex-shrink-0 border-3 border-white border-opacity-40 hover:border-opacity-70 transition-all shadow-lg"
                disabled={uploadingAvatar}
              >
                {uploadingAvatar ? (
                  <div className="w-full h-full bg-white bg-opacity-20 flex items-center justify-center">
                    <div className="w-8 h-8 border-3 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : avatarUrl ? (
                  <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-white bg-opacity-20 flex items-center justify-center">
                    <svg className="w-10 h-10 text-white opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                )}
                <div className="absolute bottom-1 right-1 w-7 h-7 bg-white rounded-full flex items-center justify-center shadow-md">
                  <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
              </button>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold truncate">
                  {editYourName && couplePartnerName
                    ? `${editYourName} & ${couplePartnerName}`
                    : editYourName || couplePartnerName || 'Set your names'}
                </h2>
                {authEmail && <p className="text-sm opacity-80 mt-0.5 truncate">{authEmail}</p>}
                {coupleWeddingDate && (
                  <p className="text-xs opacity-70 mt-1">📅 {new Date(coupleWeddingDate + 'T00:00:00').toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                )}
              </div>
            </div>
            <button
              onClick={openEditProfile}
              className="w-full mt-4 px-4 py-2.5 bg-white bg-opacity-20 text-white rounded-xl font-semibold text-sm hover:bg-opacity-30 transition-colors"
            >
              ✏️ Edit Profile
            </button>
          </div>

          {/* Switch Account */}
          <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h3 className="text-sm font-bold text-gray-900">Switch Account</h3>
              {target && (
                <p className="text-xs text-gray-500 mt-1">
                  You tried to open {target === 'vendor' ? 'Vendor' : 'Couple'} pages.
                </p>
              )}
              {profile?.active_role && (
                <p className="text-xs text-gray-500 mt-1">
                  Current active role: {profile.active_role === 'vendor' ? 'Vendor' : 'Couple'}
                </p>
              )}
            </div>
            <div className="p-4 space-y-3">
              {loadingRole ? (
                <div className="text-sm text-gray-500">Loading roles…</div>
              ) : (
                <>
                  <button
                    disabled={!profile?.has_couple || savingRole !== null}
                    onClick={() => handleSwitch('couple')}
                    className={`w-full text-left rounded-xl border p-4 transition-colors ${
                      profile?.has_couple
                        ? 'border-purple-200 bg-white hover:border-purple-400'
                        : 'border-gray-200 bg-gray-50 text-gray-400'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-semibold">Couple mode</h4>
                        <p className="text-xs text-gray-500 mt-1">Plan your wedding and manage your tasks.</p>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${profile?.has_couple ? 'bg-purple-100 text-purple-700' : 'bg-gray-200 text-gray-500'}`}>
                        {profile?.has_couple ? 'Available' : 'Not set up'}
                      </span>
                    </div>
                  </button>
                  <button
                    disabled={!profile?.has_vendor || savingRole !== null}
                    onClick={() => handleSwitch('vendor')}
                    className={`w-full text-left rounded-xl border p-4 transition-colors ${
                      profile?.has_vendor
                        ? 'border-purple-200 bg-white hover:border-purple-400'
                        : 'border-gray-200 bg-gray-50 text-gray-400'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-semibold">Vendor mode</h4>
                        <p className="text-xs text-gray-500 mt-1">Manage your business and services.</p>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${profile?.has_vendor ? 'bg-purple-100 text-purple-700' : 'bg-gray-200 text-gray-500'}`}>
                        {profile?.has_vendor ? 'Available' : 'Not set up'}
                      </span>
                    </div>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* App Preferences */}
          <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h3 className="text-sm font-bold text-gray-900">App Preferences</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {/* Notifications Toggle */}
              <div className="px-4 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">In-App Notifications</p>
                      <p className="text-xs text-gray-500">Quote updates, messages, bookings</p>
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      const next = !notificationsEnabled;
                      setNotificationsEnabled(next);
                      if (authUserId) {
                        await supabase.from('user_preferences').upsert({
                          user_id: authUserId,
                          in_app_notifications: next,
                          updated_at: new Date().toISOString(),
                        });
                      }
                    }}
                    disabled={notifLoading}
                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                      notificationsEnabled ? 'bg-purple-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                        notificationsEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
                <p className="text-[11px] text-gray-400 mt-2 ml-13 leading-relaxed">
                  Currently in-app only. Triggers: quote status changes, new messages, vendor publish approvals.
                </p>
              </div>

              {/* Dark Mode Toggle */}
              <div className="px-4 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Dark Mode</p>
                    <p className="text-xs text-gray-500">Easier on the eyes at night</p>
                  </div>
                </div>
                <button
                  onClick={() => setDarkModeEnabled(!darkModeEnabled)}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                    darkModeEnabled ? 'bg-purple-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                      darkModeEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Language Dropdown */}
              <div className="px-4 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">Language</p>
                    <p className="text-xs text-gray-500">Choose your preferred language</p>
                  </div>
                </div>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="px-3 py-1.5 border-2 border-gray-300 rounded-lg text-sm font-semibold text-gray-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="English">English</option>
                  <option value="Zulu">Zulu</option>
                  <option value="Xhosa">Xhosa</option>
                  <option value="Afrikaans">Afrikaans</option>
                  <option value="Sotho">Sotho</option>
                </select>
              </div>
            </div>
          </div>

          {/* Support */}
          <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h3 className="text-sm font-bold text-gray-900">Support</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {supportItems.map((item) => (
                <button
                  key={item.id}
                  onClick={item.action}
                  className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-gray-600">
                      {item.icon}
                    </div>
                    <span className="text-sm font-semibold text-gray-900">{item.label}</span>
                  </div>
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
            </div>
          </div>

          {/* Legal */}
          <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h3 className="text-sm font-bold text-gray-900">Legal</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {legalItems.map((item) => (
                <button
                  key={item.id}
                  onClick={item.action}
                  className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-gray-600">
                      {item.icon}
                    </div>
                    <span className="text-sm font-semibold text-gray-900">{item.label}</span>
                  </div>
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
            </div>
          </div>

          {/* Account */}
          <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h3 className="text-sm font-bold text-gray-900">Account</h3>
            </div>
            <div className="divide-y divide-gray-100">
              <button
                onClick={handleSignOut}
                className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-red-50 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span className="text-sm font-semibold text-red-600">Sign Out</span>
                </div>
              </button>
            </div>
          </div>

          {/* App Info */}
          <div className="text-center py-4 space-y-1">
            <p className="text-xs text-gray-500">uMshado App</p>
            <p className="text-xs text-gray-400">Version 1.0.0</p>
            <p className="text-xs text-gray-400">Made with ❤️ in South Africa</p>
          </div>
        </div>
      </div>

      {/* ════════════ EDIT PROFILE MODAL ════════════ */}
      {showEditProfile && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Edit Profile</h3>

            {profileSaveMsg && (
              <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-semibold ${profileSaveMsg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {profileSaveMsg.text}
              </div>
            )}

            <div className="space-y-4">
              {/* Your Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Your Name</label>
                <input
                  type="text"
                  value={editYourName}
                  onChange={e => setEditYourName(e.target.value)}
                  placeholder="e.g., Mthabisi"
                  className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm text-gray-900"
                />
              </div>

              {/* Partner Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Partner&apos;s Name</label>
                <input
                  type="text"
                  value={editPartnerName}
                  onChange={e => setEditPartnerName(e.target.value)}
                  placeholder="e.g., Mafuyane"
                  className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm text-gray-900"
                />
              </div>

              {/* Wedding Date */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Wedding Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={editWeddingDate}
                  onChange={e => { setEditWeddingDate(e.target.value); setProfileSaveMsg(null); }}
                  min={todayStr}
                  className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm text-gray-900"
                />
                <p className="text-xs text-gray-500 mt-1">Must be today or a future date</p>
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Wedding Location</label>
                <input
                  type="text"
                  value={editLocation}
                  onChange={e => setEditLocation(e.target.value)}
                  placeholder="e.g., Johannesburg, Sandton"
                  className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm text-gray-900"
                />
              </div>

              {/* Country */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Country</label>
                <input
                  type="text"
                  value={editCountry}
                  onChange={e => setEditCountry(e.target.value)}
                  placeholder="e.g., South Africa"
                  className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm text-gray-900"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowEditProfile(false); setProfileSaveMsg(null); }}
                className="flex-1 px-4 py-2.5 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveProfile}
                disabled={profileSaving}
                className={`flex-1 px-4 py-2.5 rounded-xl font-semibold transition-colors shadow-lg shadow-purple-200 ${profileSaving ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-purple-600 text-white hover:bg-purple-700'}`}
              >
                {profileSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div></div>}>
      <SettingsContent />
    </Suspense>
  );
}
