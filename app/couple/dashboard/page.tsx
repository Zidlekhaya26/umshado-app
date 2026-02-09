'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import BottomNav from '@/components/BottomNav';
import { supabase } from '@/lib/supabaseClient';

// ─── Types (match Supabase tables) ───────────────────────

interface DbTask {
  id: string;
  couple_id: string;
  title: string;
  due_date: string | null;
  is_done: boolean;
  created_at: string;
}

interface DbBudgetItem {
  id: string;
  couple_id: string;
  title: string;
  amount: number;
  amount_paid: number;
  category: string | null;
  status: 'planned' | 'partial' | 'paid';
  created_at: string;
}

interface RecentQuote {
  id: string;
  quote_ref: string;
  vendor_id: string;
  package_name: string;
  status: string;
  created_at: string;
  vendor_name: string;
}

interface DbGuest {
  id: string;
  couple_id: string;
  full_name: string;
  rsvp_status: 'pending' | 'accepted' | 'declined';
}

interface CoupleProfile {
  partner_name: string | null;
  wedding_date: string | null;
  location: string | null;
  avatar_url: string | null;
}

// ─── Helpers ─────────────────────────────────────────────

/** Compute days remaining from a date string (YYYY-MM-DD) to today */
const daysUntil = (dateStr: string): number => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + 'T00:00:00');
  const diff = target.getTime() - today.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
};

/** Format YYYY-MM-DD → "15 March 2026" */
const formatWeddingDate = (dateStr: string): string => {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });
};

// ─── Component ───────────────────────────────────────────

export default function CoupleDashboard() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Couple profile from Supabase
  const [coupleProfile, setCoupleProfile] = useState<CoupleProfile | null>(null);
  const [userName, setUserName] = useState<string | null>(null);

  // Real data from Supabase
  const [tasks, setTasks] = useState<DbTask[]>([]);
  const [budgetItems, setBudgetItems] = useState<DbBudgetItem[]>([]);

  // Guests from Supabase
  const [guests, setGuests] = useState<DbGuest[]>([]);

  // Quotes from Supabase
  const [recentQuotes, setRecentQuotes] = useState<RecentQuote[]>([]);
  const [loadingQuotes, setLoadingQuotes] = useState(true);

  // Avatar upload
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Inline wedding date editing
  const [showDateModal, setShowDateModal] = useState(false);
  const [editDate, setEditDate] = useState('');
  const [savingDate, setSavingDate] = useState(false);

  // ── Auth + hydrate from Supabase ───────────────────────

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoaded(true);
        setLoadingQuotes(false);
        return;
      }
      setUserId(user.id);

      // Resolve the logged-in user's display name (profile → auth metadata)
      const authName =
        (user.user_metadata as Record<string, string> | undefined)?.full_name
        || (user.user_metadata as Record<string, string> | undefined)?.name
        || null;

      // Load profile name, couple profile, tasks, budget, and guests from Supabase in parallel
      const [profileRes, coupleRes, tasksRes, budgetRes, guestsRes] = await Promise.all([
        supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
        supabase.from('couples').select('partner_name, wedding_date, location, avatar_url').eq('id', user.id).maybeSingle(),
        supabase.from('couple_tasks').select('*').eq('couple_id', user.id).order('created_at'),
        supabase.from('couple_budget_items').select('*').eq('couple_id', user.id).order('created_at'),
        supabase.from('couple_guests').select('id, couple_id, full_name, rsvp_status').eq('couple_id', user.id),
      ]);
      setUserName(profileRes.data?.full_name || authName);
      if (coupleRes.data) setCoupleProfile(coupleRes.data);
      if (tasksRes.data) setTasks(tasksRes.data);
      if (budgetRes.data) setBudgetItems(budgetRes.data.map((item) => ({ ...item, amount_paid: item.amount_paid ?? 0 })));
      if (guestsRes.data) setGuests(guestsRes.data);
      setLoaded(true);

      // Fetch quotes from Supabase
      try {
        const { data, error } = await supabase
          .from('quotes')
          .select('id, quote_ref, vendor_id, package_name, status, created_at')
          .eq('couple_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5);

        if (!error && data) {
          const withVendors = await Promise.all(
            data.map(async (quote) => {
              const { data: vendorData } = await supabase
                .from('vendors')
                .select('business_name')
                .eq('id', quote.vendor_id)
                .maybeSingle();
              return { ...quote, vendor_name: vendorData?.business_name || 'Vendor' } as RecentQuote;
            }),
          );
          setRecentQuotes(withVendors);
        }
      } catch (err) {
        console.error('Error loading recent quotes:', err);
      } finally {
        setLoadingQuotes(false);
      }
    })();
  }, []);

  // ── Derived progress ───────────────────────────────────

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.is_done).length;
  const progressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Upcoming tasks (incomplete, sorted by earliest due date)
  const upcomingTasks = tasks
    .filter(t => !t.is_done)
    .slice(0, 4);

  const totalBudget = budgetItems.reduce((s, b) => s + Number(b.amount), 0);
  const totalPaid = budgetItems.reduce((s, b) => s + Number(b.amount_paid || 0), 0);
  const totalRemaining = totalBudget - totalPaid;

  const hasBudget = budgetItems.length > 0;
  const hasTasks = tasks.length > 0;
  const hasGuests = guests.length > 0;

  // ── Guest stats ────────────────────────────────────────

  const totalGuests = guests.length;
  const guestsAccepted = guests.filter(g => g.rsvp_status === 'accepted').length;
  const guestsPending = guests.filter(g => g.rsvp_status === 'pending').length;
  const guestsDeclined = guests.filter(g => g.rsvp_status === 'declined').length;

  // ── Avatar upload handler ──────────────────────────────

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;

    // Validate file type and size (max 5MB)
    if (!file.type.startsWith('image/')) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be under 5MB');
      return;
    }

    setUploadingAvatar(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${userId}/avatar.${ext}`;

      // Upload to couple-avatars bucket (upsert to overwrite)
      const { error: uploadErr } = await supabase.storage
        .from('couple-avatars')
        .upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('couple-avatars')
        .getPublicUrl(path);
      const publicUrl = urlData.publicUrl;

      // Save URL to couples table
      await supabase.from('couples').upsert({
        id: userId,
        avatar_url: publicUrl,
      });

      setCoupleProfile(prev => prev ? { ...prev, avatar_url: publicUrl } : prev);
    } catch (err) {
      console.error('Avatar upload failed:', err);
    } finally {
      setUploadingAvatar(false);
    }
  };

  // ── Inline wedding date save ───────────────────────────

  const openDateModal = () => {
    setEditDate(coupleProfile?.wedding_date ?? '');
    setShowDateModal(true);
  };

  const saveWeddingDate = async () => {
    if (!userId) return;
    // Validate date is not in the past
    if (editDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const selected = new Date(editDate + 'T00:00:00');
      if (selected < today) {
        alert('Wedding date cannot be in the past.');
        return;
      }
    }
    setSavingDate(true);
    const { error } = await supabase.from('couples').upsert({
      id: userId,
      wedding_date: editDate || null,
    });
    if (!error) {
      setCoupleProfile(prev => prev ? { ...prev, wedding_date: editDate || null } : prev);
      setShowDateModal(false);
    } else {
      console.error('Failed to save wedding date:', error);
      alert('Failed to save. Please try again.');
    }
    setSavingDate(false);
  };

  // ── Countdown ──────────────────────────────────────────

  const weddingDate = coupleProfile?.wedding_date ?? null;
  const daysRemaining = weddingDate ? daysUntil(weddingDate) : null;

  // ── Quick actions ──────────────────────────────────────

  const quickActions = [
    {
      name: 'Add Task',
      href: '/couple/planner?tab=tasks',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      ),
      color: 'purple',
    },
    {
      name: 'Add Guest',
      href: '/couple/planner?tab=guests',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
        </svg>
      ),
      color: 'blue',
    },
    {
      name: 'Messages',
      href: '/messages',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
      color: 'pink',
    },
    {
      name: 'Browse Vendors',
      href: '/marketplace',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      ),
      color: 'green',
    },
    {
      name: 'Request Quote',
      href: '/quotes/new',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      color: 'orange',
    },
  ];

  const getActionColorClasses = (color: string) => {
    const colors: Record<string, string> = {
      purple: 'bg-purple-50 text-purple-600 hover:bg-purple-100',
      blue: 'bg-blue-50 text-blue-600 hover:bg-blue-100',
      green: 'bg-green-50 text-green-600 hover:bg-green-100',
      pink: 'bg-pink-50 text-pink-600 hover:bg-pink-100',
      orange: 'bg-orange-50 text-orange-600 hover:bg-orange-100',
    };
    return colors[color] || colors.purple;
  };

  // ── Loading ────────────────────────────────────────────

  if (!loaded) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto min-h-screen bg-white shadow-lg flex flex-col pb-24">
        {/* Hidden file input for avatar upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleAvatarUpload}
        />

        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-4 py-5">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <h1 className="text-xl font-bold text-gray-900">
                {userName && coupleProfile?.partner_name
                  ? `${userName} & ${coupleProfile.partner_name}`
                  : userName
                    ? `Hi, ${userName}`
                    : coupleProfile?.partner_name
                      ? `Hi, ${coupleProfile.partner_name}`
                      : 'Home'}
              </h1>
              <p className="text-sm text-gray-600 mt-0.5">Your wedding planning at a glance</p>
            </div>
            <Link href="/settings" className="p-2 rounded-full hover:bg-gray-100 transition-colors" aria-label="Settings">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </Link>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 px-4 py-5 space-y-5 overflow-y-auto">

          {/* Wedding Countdown Card */}
          {weddingDate ? (
            <div className="bg-gradient-to-r from-pink-500 to-purple-600 rounded-xl p-5 text-white shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium opacity-90">
                    {daysRemaining === 0 ? '🎉 Your Wedding Day!' : 'Days Until Your Wedding'}
                  </p>
                  <p className="text-4xl font-bold mt-1">
                    {daysRemaining === 0 ? 'Today!' : `${daysRemaining}`}
                  </p>
                  {daysRemaining !== null && daysRemaining > 0 && (
                    <p className="text-sm opacity-90 mt-1">days to go</p>
                  )}
                  <p className="text-xs opacity-80 mt-2">📅 {formatWeddingDate(weddingDate)}</p>
                  {coupleProfile?.location && (
                    <p className="text-xs opacity-80 mt-0.5">📍 {coupleProfile.location}</p>
                  )}
                </div>
                {/* Avatar upload circle */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="relative w-28 h-28 rounded-full overflow-hidden flex-shrink-0 border-3 border-white border-opacity-40 hover:border-opacity-70 transition-all shadow-lg"
                  aria-label="Upload profile photo"
                  disabled={uploadingAvatar}
                >
                  {uploadingAvatar ? (
                    <div className="w-full h-full bg-white bg-opacity-20 flex items-center justify-center">
                      <div className="w-8 h-8 border-3 border-white border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : coupleProfile?.avatar_url ? (
                    <img src={coupleProfile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-white bg-opacity-20 flex items-center justify-center">
                      <svg className="w-10 h-10 text-white opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                  )}
                  {/* Camera badge */}
                  <div className="absolute bottom-1 right-1 w-7 h-7 bg-white rounded-full flex items-center justify-center shadow-md">
                    <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                </button>
              </div>
              <button
                onClick={openDateModal}
                className="inline-flex items-center gap-1 mt-3 px-3 py-1.5 bg-white bg-opacity-20 rounded-full text-xs font-semibold hover:bg-opacity-30 transition-colors"
                aria-label="Edit wedding date"
              >
                ✏️
              </button>
            </div>
          ) : (
            <div className="bg-gradient-to-r from-pink-500 to-purple-600 rounded-xl p-5 text-white shadow-lg text-center">
              {/* Avatar upload circle (empty state) */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="relative w-28 h-28 rounded-full overflow-hidden mx-auto mb-3 border-3 border-white border-opacity-40 hover:border-opacity-70 transition-all shadow-lg"
                aria-label="Upload profile photo"
                disabled={uploadingAvatar}
              >
                {uploadingAvatar ? (
                  <div className="w-full h-full bg-white bg-opacity-20 flex items-center justify-center">
                    <div className="w-8 h-8 border-3 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : coupleProfile?.avatar_url ? (
                  <img src={coupleProfile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
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
              <p className="text-base font-bold mb-1">Set your wedding date</p>
              <p className="text-sm opacity-90 mb-4">Add your date to start the countdown!</p>
              <button
                onClick={openDateModal}
                className="inline-block px-5 py-2 bg-white text-purple-700 rounded-full text-sm font-semibold hover:bg-purple-50 transition-colors"
              >
                Set Wedding Date
              </button>
            </div>
          )}

          {/* Progress Card */}
          {hasTasks ? (
            <div className="bg-white rounded-xl border-2 border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold text-gray-700">Planning Progress</p>
                  <p className="text-3xl font-bold text-purple-600 mt-1">{progressPct}%</p>
                </div>
                <div className="w-14 h-14 bg-purple-50 rounded-full flex items-center justify-center">
                  <svg className="w-7 h-7 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-3 mb-2">
                <div
                  className="bg-purple-600 rounded-full h-3 transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="text-xs text-gray-500">
                {completedTasks} of {totalTasks} tasks completed
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border-2 border-dashed border-gray-300 p-5 text-center">
              <div className="w-14 h-14 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-7 h-7 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <p className="text-base font-bold text-gray-900 mb-1">Start planning your wedding</p>
              <p className="text-sm text-gray-600 mb-4">Add tasks to track your progress</p>
              <Link
                href="/couple/planner?tab=tasks"
                className="inline-block px-5 py-2 bg-purple-600 text-white rounded-full text-sm font-semibold hover:bg-purple-700 transition-colors"
              >
                + Add Your First Task
              </Link>
            </div>
          )}

          {/* Quick Actions */}
          <div>
            <h2 className="text-base font-bold text-gray-900 mb-3">Quick Actions</h2>
            <div className="grid grid-cols-3 gap-2">
              {quickActions.map(action => (
                <Link
                  key={action.name}
                  href={action.href}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl transition-colors ${getActionColorClasses(action.color)}`}
                >
                  {action.icon}
                  <span className="text-xs font-semibold mt-2 text-center">{action.name}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Recent Quote Requests */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-gray-900">Recent Quote Requests</h2>
              <Link href="/messages" className="text-sm font-semibold text-purple-600 hover:text-purple-700">
                View all
              </Link>
            </div>

            {loadingQuotes && (
              <div className="bg-white rounded-xl border-2 border-gray-200 p-6 text-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600 mx-auto" />
                <p className="text-sm text-gray-600 mt-3">Loading quotes...</p>
              </div>
            )}

            {!loadingQuotes && recentQuotes.length === 0 && (
              <div className="bg-white rounded-xl border-2 border-dashed border-gray-300 p-6 text-center">
                <div className="w-12 h-12 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-xl">💬</span>
                </div>
                <p className="text-sm font-semibold text-gray-900 mb-1">No quotes yet</p>
                <p className="text-xs text-gray-600 mb-4">Browse vendors and request your first quote.</p>
                <Link
                  href="/marketplace"
                  className="inline-block px-4 py-2 bg-purple-600 text-white rounded-full text-xs font-semibold hover:bg-purple-700 transition-colors"
                >
                  Browse Vendors
                </Link>
              </div>
            )}

            {!loadingQuotes && recentQuotes.length > 0 && (
              <div className="bg-white rounded-xl border-2 border-gray-200 divide-y divide-gray-100 overflow-hidden">
                {recentQuotes.map(quote => (
                  <Link
                    key={quote.id}
                    href="/messages"
                    className="block px-4 py-3.5 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs font-mono text-purple-600 font-semibold">{quote.quote_ref}</p>
                        <p className="text-sm font-semibold text-gray-900 mt-1">{quote.vendor_name}</p>
                        <p className="text-xs text-gray-600 mt-1">{quote.package_name}</p>
                      </div>
                      <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-semibold rounded-full capitalize">
                        {quote.status}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming Tasks */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-gray-900">Upcoming Tasks</h2>
              <Link href="/couple/planner" className="text-sm font-semibold text-purple-600 hover:text-purple-700">
                View all
              </Link>
            </div>

            {upcomingTasks.length === 0 ? (
              <div className="bg-white rounded-xl border-2 border-dashed border-gray-300 p-6 text-center">
                <div className="w-12 h-12 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-xl">📋</span>
                </div>
                <p className="text-sm font-semibold text-gray-900 mb-1">
                  {hasTasks ? 'All tasks completed!' : 'No tasks yet'}
                </p>
                <p className="text-xs text-gray-600 mb-4">
                  {hasTasks
                    ? 'Great work — you\'re on top of everything.'
                    : 'Plan your milestones in the Planner.'}
                </p>
                <Link
                  href="/couple/planner?tab=tasks"
                  className="inline-block px-4 py-2 bg-purple-600 text-white rounded-full text-xs font-semibold hover:bg-purple-700 transition-colors"
                >
                  {hasTasks ? 'View Planner' : '+ Add Task'}
                </Link>
              </div>
            ) : (
              <div className="bg-white rounded-xl border-2 border-gray-200 divide-y divide-gray-100 overflow-hidden">
                {upcomingTasks.map(task => (
                  <Link
                    key={task.id}
                    href="/couple/planner?tab=tasks"
                    className="block px-4 py-3.5 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full mt-2 flex-shrink-0 bg-blue-500" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{task.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span className="text-xs text-gray-600">{task.due_date ? new Date(task.due_date).toLocaleDateString('en-ZA', { year: 'numeric', month: 'short', day: 'numeric' }) : 'No date set'}</span>
                        </div>
                      </div>
                      <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Budget Snapshot */}
          <div>
            <h2 className="text-base font-bold text-gray-900 mb-3">Budget Overview</h2>
            {hasBudget ? (
              <div className="bg-white rounded-xl border-2 border-gray-200 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Total Budget</span>
                  <span className="text-base font-bold text-gray-900">R{totalBudget.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Paid</span>
                  <span className="text-base font-bold text-red-600">R{totalPaid.toLocaleString()}</span>
                </div>
                <div className="pt-3 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-900">Remaining</span>
                    <span className="text-lg font-bold text-green-600">R{totalRemaining.toLocaleString()}</span>
                  </div>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5 mt-3">
                  <div
                    className="bg-purple-600 rounded-full h-2.5 transition-all duration-500"
                    style={{ width: `${totalBudget > 0 ? Math.round((totalPaid / totalBudget) * 100) : 0}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 text-center">
                  {totalBudget > 0 ? Math.round((totalPaid / totalBudget) * 100) : 0}% of budget paid
                </p>
                <Link
                  href="/couple/planner?tab=budget"
                  className="block w-full px-4 py-2.5 bg-purple-50 text-purple-600 rounded-lg font-semibold text-sm text-center hover:bg-purple-100 transition-colors mt-3"
                >
                  Manage Budget
                </Link>
              </div>
            ) : (
              <div className="bg-white rounded-xl border-2 border-dashed border-gray-300 p-6 text-center">
                <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-xl">💰</span>
                </div>
                <p className="text-sm font-semibold text-gray-900 mb-1">No budget set</p>
                <p className="text-xs text-gray-600 mb-4">Set up budget categories to track your spending.</p>
                <Link
                  href="/couple/planner?tab=budget"
                  className="inline-block px-4 py-2 bg-purple-600 text-white rounded-full text-xs font-semibold hover:bg-purple-700 transition-colors"
                >
                  + Set Budget
                </Link>
              </div>
            )}
          </div>

          {/* Guest Summary */}
          <div>
            <h2 className="text-base font-bold text-gray-900 mb-3">Guest List</h2>
            {hasGuests ? (
              <div className="bg-white rounded-xl border-2 border-gray-200 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Total Invited</span>
                  <span className="text-base font-bold text-gray-900">{totalGuests}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-green-50 rounded-lg p-2.5 text-center">
                    <p className="text-lg font-bold text-green-600">{guestsAccepted}</p>
                    <p className="text-[10px] font-semibold text-green-700 mt-0.5">Accepted</p>
                  </div>
                  <div className="bg-yellow-50 rounded-lg p-2.5 text-center">
                    <p className="text-lg font-bold text-yellow-600">{guestsPending}</p>
                    <p className="text-[10px] font-semibold text-yellow-700 mt-0.5">Pending</p>
                  </div>
                  <div className="bg-red-50 rounded-lg p-2.5 text-center">
                    <p className="text-lg font-bold text-red-600">{guestsDeclined}</p>
                    <p className="text-[10px] font-semibold text-red-700 mt-0.5">Declined</p>
                  </div>
                </div>
                <Link
                  href="/couple/planner?tab=guests"
                  className="block w-full px-4 py-2.5 bg-purple-50 text-purple-600 rounded-lg font-semibold text-sm text-center hover:bg-purple-100 transition-colors mt-3"
                >
                  Manage Guest List
                </Link>
              </div>
            ) : (
              <div className="bg-white rounded-xl border-2 border-dashed border-gray-300 p-6 text-center">
                <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-xl">👥</span>
                </div>
                <p className="text-sm font-semibold text-gray-900 mb-1">No guests yet</p>
                <p className="text-xs text-gray-600 mb-4">Start building your guest list.</p>
                <Link
                  href="/couple/planner?tab=guests"
                  className="inline-block px-4 py-2 bg-purple-600 text-white rounded-full text-xs font-semibold hover:bg-purple-700 transition-colors"
                >
                  + Add First Guest
                </Link>
              </div>
            )}
          </div>

          {/* Motivational Card */}
          <div className="bg-gradient-to-r from-pink-50 to-purple-50 border-2 border-pink-200 rounded-xl px-4 py-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-pink-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-2xl">💍</span>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900 mb-1">You&apos;re doing great!</p>
                <p className="text-xs text-gray-700 leading-relaxed">
                  Your wedding is coming together beautifully. Keep up the momentum!
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Wedding Date Edit Modal */}
      {showDateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              {coupleProfile?.wedding_date ? 'Edit Wedding Date' : 'Set Wedding Date'}
            </h3>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Wedding Date</label>
              <input
                type="date"
                value={editDate}
                onChange={e => setEditDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900"
              />
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowDateModal(false)}
                className="flex-1 px-4 py-2.5 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveWeddingDate}
                disabled={savingDate}
                className="flex-1 px-4 py-2.5 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 transition-colors shadow-lg shadow-purple-200 disabled:opacity-60"
              >
                {savingDate ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
