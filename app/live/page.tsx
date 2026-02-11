'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, Suspense, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import BottomNav from '@/components/BottomNav';
import { supabase } from '@/lib/supabaseClient';

// ─── Types ───────────────────────────────────────────────

interface LiveEvent {
  id: string;
  couple_id: string;
  title: string;
  time: string;
  location: string | null;
  sort_order: number;
  created_at: string;
}

interface WellWish {
  id: string;
  couple_id: string;
  guest_name: string;
  message: string;
  created_at: string;
}

interface LiveMoment {
  id: string;
  couple_id: string;
  guest_name: string;
  caption: string | null;
  media_url: string | null;
  created_at: string;
}

// ─── Helpers ─────────────────────────────────────────────

const formatTime12h = (time24: string): string => {
  if (!time24 || !time24.includes(':')) return time24;
  const [hStr, mStr] = time24.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr;
  const ampm = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${m} ${ampm}`;
};

const timeAgo = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

// ─── Empty State ─────────────────────────────────────────

function EmptyState({ icon, title, description, actionLabel, onAction }: {
  icon: string; title: string; description: string; actionLabel?: string; onAction?: () => void;
}) {
  return (
    <div className="bg-white rounded-xl border-2 border-dashed border-gray-300 p-8 text-center">
      <div className="w-14 h-14 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-4">
        <span className="text-2xl">{icon}</span>
      </div>
      <h3 className="text-base font-bold text-gray-900 mb-1">{title}</h3>
      <p className="text-sm text-gray-600 mb-5">{description}</p>
      {actionLabel && onAction && (
        <button onClick={onAction} className="px-5 py-2.5 bg-purple-600 text-white rounded-full text-sm font-semibold hover:bg-purple-700 transition-colors shadow-md">
          {actionLabel}
        </button>
      )}
    </div>
  );
}

// ─── Main Content ────────────────────────────────────────

function LivePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const urlTab = searchParams.get('tab') || 'day';

  const [activeTab, setActiveTab] = useState<'day' | 'wishes' | 'moments'>(
    (['day', 'wishes', 'moments'].includes(urlTab) ? urlTab : 'day') as 'day' | 'wishes' | 'moments'
  );
  const [userId, setUserId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Data
  const [schedule, setSchedule] = useState<LiveEvent[]>([]);
  const [wishes, setWishes] = useState<WellWish[]>([]);
  const [moments, setMoments] = useState<LiveMoment[]>([]);

  // Guest link
  const [guestToken, setGuestToken] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  // Schedule form
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleTitle, setScheduleTitle] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduleLocation, setScheduleLocation] = useState('');

  // Edit Schedule
  const [editingEvent, setEditingEvent] = useState<LiveEvent | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editLocation, setEditLocation] = useState('');

  // ─── Data loading ──────────────────────────────────────

  const loadData = useCallback(async (uid: string) => {
    const [s, w, m] = await Promise.all([
      supabase.from('live_events').select('*').eq('couple_id', uid).order('sort_order'),
      supabase.from('live_well_wishes').select('*').eq('couple_id', uid).order('created_at', { ascending: false }),
      supabase.from('live_moments').select('*').eq('couple_id', uid).order('created_at', { ascending: false }),
    ]);
    if (s.data) setSchedule(s.data);
    if (w.data) setWishes(w.data);
    if (m.data) setMoments(m.data);
  }, []);

  const loadGuestToken = useCallback(async (accessToken: string) => {
    try {
      const res = await fetch('/api/live/link', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setGuestToken(data.token);
      }
    } catch (err) {
      console.warn('Failed to load guest link:', err);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { router.replace('/auth/sign-in'); return; }
      setUserId(session.user.id);
      await Promise.all([
        loadData(session.user.id),
        loadGuestToken(session.access_token),
      ]);
      setLoaded(true);
    })();
  }, [router, loadData, loadGuestToken]);

  useEffect(() => {
    if (['day', 'wishes', 'moments'].includes(urlTab) && urlTab !== activeTab) {
      setActiveTab(urlTab as 'day' | 'wishes' | 'moments');
    }
  }, [urlTab, activeTab]);

  const handleTabChange = (tab: 'day' | 'wishes' | 'moments') => {
    setActiveTab(tab);
    router.push(`/live?tab=${tab}`);
  };

  // ─── Guest link ────────────────────────────────────────

  const guestUrl = guestToken
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/live/guest?token=${guestToken}`
    : null;

  const copyGuestLink = async () => {
    if (!guestUrl) return;
    try {
      await navigator.clipboard.writeText(guestUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      const input = document.createElement('input');
      input.value = guestUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };

  // ─── Schedule CRUD ─────────────────────────────────────

  const addScheduleEvent = async () => {
    if (!scheduleTitle.trim() || !scheduleTime || !userId) return;
    const nextOrder = schedule.length > 0 ? Math.max(...schedule.map(s => s.sort_order)) + 1 : 0;

    const { data, error } = await supabase.from('live_events').insert({
      couple_id: userId,
      title: scheduleTitle.trim(),
      time: scheduleTime,
      location: scheduleLocation.trim() || null,
      sort_order: nextOrder,
    }).select().single();

    if (error) {
      console.error('Error adding event:', error);
      alert('Failed to add schedule item.');
      return;
    }

    setSchedule(prev => [...prev, data].sort((a, b) => a.time.localeCompare(b.time)));
    setScheduleTitle(''); setScheduleTime(''); setScheduleLocation('');
    setShowScheduleModal(false);
  };

  const startEditEvent = (ev: LiveEvent) => {
    setEditingEvent(ev);
    setEditTitle(ev.title);
    setEditTime(ev.time);
    setEditLocation(ev.location || '');
  };

  const saveEditEvent = async () => {
    if (!editingEvent || !editTitle.trim() || !editTime) return;
    const { error } = await supabase.from('live_events').update({
      title: editTitle.trim(),
      time: editTime,
      location: editLocation.trim() || null,
    }).eq('id', editingEvent.id);

    if (!error) {
      setSchedule(prev => prev.map(s => s.id === editingEvent.id
        ? { ...s, title: editTitle.trim(), time: editTime, location: editLocation.trim() || null }
        : s
      ).sort((a, b) => a.time.localeCompare(b.time)));
    }
    setEditingEvent(null);
  };

  const deleteEvent = async (id: string) => {
    const { error } = await supabase.from('live_events').delete().eq('id', id);
    if (!error) setSchedule(prev => prev.filter(s => s.id !== id));
  };

  // ─── Well wishes (couple can delete) ──────────────────

  const deleteWish = async (id: string) => {
    const { error } = await supabase.from('live_well_wishes').delete().eq('id', id);
    if (!error) setWishes(prev => prev.filter(w => w.id !== id));
  };

  // ─── Moments (couple can delete) ──────────────────────

  const deleteMoment = async (id: string) => {
    const { error } = await supabase.from('live_moments').delete().eq('id', id);
    if (!error) setMoments(prev => prev.filter(m => m.id !== id));
  };

  // ─── Loading state ─────────────────────────────────────

  if (!loaded) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full max-w-screen-xl mx-auto min-h-screen flex flex-col pb-24 px-4">

        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white px-4 py-5 shadow-lg">
          <h1 className="text-xl font-bold">Live</h1>
          <p className="text-sm opacity-90 mt-1">Your wedding day experience</p>
        </div>

        {/* Tab Pills */}
        <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10">
          <div className="flex gap-2">
            {[
              { key: 'day', label: 'Schedule' },
              { key: 'wishes', label: 'Well Wishes' },
              { key: 'moments', label: 'Moments' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key as 'day' | 'wishes' | 'moments')}
                className={`flex-1 px-3 py-2 rounded-full text-sm font-semibold transition-all ${
                  activeTab === tab.key
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto bg-gray-50">

          {/* ═══ SCHEDULE TAB ═══ */}
          {activeTab === 'day' && (
            <div className="p-4 space-y-5">

              {/* Share with Guests */}
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border-2 border-purple-200 p-4">
                <h2 className="text-base font-bold text-gray-900 mb-1">📲 Share with Guests</h2>
                <p className="text-xs text-gray-600 mb-3">Guests can view your schedule, send wishes, and share moments.</p>

                {guestUrl ? (
                  <div className="space-y-3">
                    {/* QR Code */}
                    <div className="flex justify-center">
                      <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-200">
                        <QRCodeSVG value={guestUrl} size={160} level="M" />
                      </div>
                    </div>

                    {/* Link + Copy */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={guestUrl}
                        className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs text-gray-700 truncate"
                        onClick={(e) => (e.target as HTMLInputElement).select()}
                      />
                      <button
                        onClick={copyGuestLink}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                          linkCopied
                            ? 'bg-green-500 text-white'
                            : 'bg-purple-600 text-white hover:bg-purple-700'
                        }`}
                      >
                        {linkCopied ? '✓ Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <div className="w-8 h-8 border-3 border-purple-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-xs text-gray-500">Generating guest link...</p>
                  </div>
                )}
              </div>

              {/* Schedule Editor */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-bold text-gray-900">Schedule</h2>
                  <button
                    onClick={() => setShowScheduleModal(true)}
                    className="px-4 py-2 bg-purple-600 text-white rounded-full text-sm font-semibold hover:bg-purple-700 transition-colors shadow-md"
                  >
                    + Add
                  </button>
                </div>

                {schedule.length === 0 ? (
                  <EmptyState
                    icon="🗓️"
                    title="No schedule yet"
                    description="Add your wedding day timeline so guests know what's happening."
                    actionLabel="+ Add Event"
                    onAction={() => setShowScheduleModal(true)}
                  />
                ) : (
                  <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden">
                    {schedule.map((item, index) => (
                      <div
                        key={item.id}
                        className={`px-4 py-3.5 flex gap-4 ${index !== schedule.length - 1 ? 'border-b border-gray-100' : ''}`}
                      >
                        <div className="flex flex-col items-center">
                          <div className="w-16 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                            <span className="text-xs font-bold text-purple-600">{formatTime12h(item.time)}</span>
                          </div>
                          {index !== schedule.length - 1 && <div className="w-0.5 bg-purple-200 flex-1 mt-2" />}
                        </div>
                        <div className="flex-1 pb-2">
                          <p className="text-sm font-bold text-gray-900">{item.title}</p>
                          {item.location && <p className="text-xs text-gray-500 mt-1">📍 {item.location}</p>}
                        </div>
                        <div className="flex items-start gap-1">
                          <button onClick={() => startEditEvent(item)} className="text-gray-400 hover:text-purple-600 transition-colors p-1" aria-label="Edit">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                          </button>
                          <button onClick={() => deleteEvent(item.id)} className="text-gray-400 hover:text-red-500 transition-colors p-1" aria-label="Delete">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══ WELL WISHES TAB ═══ */}
          {activeTab === 'wishes' && (
            <div className="p-4 space-y-4">
              <h2 className="text-base font-bold text-gray-900">
                Well Wishes
                {wishes.length > 0 && <span className="text-sm font-normal text-gray-500 ml-2">({wishes.length})</span>}
              </h2>

              {wishes.length === 0 ? (
                <EmptyState
                  icon="💌"
                  title="No well wishes yet"
                  description="Share your guest link so friends and family can send you their love!"
                />
              ) : (
                <div className="space-y-2">
                  {wishes.map((wish) => (
                    <div key={wish.id} className="bg-white rounded-xl border-2 border-gray-200 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-bold text-gray-900">{wish.guest_name}</span>
                            <span className="text-xs text-gray-400">{timeAgo(wish.created_at)}</span>
                          </div>
                          <p className="text-sm text-gray-700">{wish.message}</p>
                        </div>
                        <button onClick={() => deleteWish(wish.id)} className="text-gray-400 hover:text-red-500 transition-colors p-1 flex-shrink-0" aria-label="Delete">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═══ MOMENTS TAB ═══ */}
          {activeTab === 'moments' && (
            <div className="p-4 space-y-4">
              <h2 className="text-base font-bold text-gray-900">
                Moments
                {moments.length > 0 && <span className="text-sm font-normal text-gray-500 ml-2">({moments.length})</span>}
              </h2>

              {moments.length === 0 ? (
                <EmptyState
                  icon="📸"
                  title="No moments yet"
                  description="Guests can share photos and memories from your special day."
                />
              ) : (
                <div className="space-y-3">
                  {moments.map((moment) => (
                    <div key={moment.id} className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden">
                      {moment.media_url && (
                        <div className="aspect-video bg-gray-100 relative">
                          <img
                            src={moment.media_url}
                            alt={moment.caption || 'Moment'}
                            className="w-full h-full object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        </div>
                      )}
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-bold text-gray-900">{moment.guest_name}</span>
                              <span className="text-xs text-gray-400">{timeAgo(moment.created_at)}</span>
                            </div>
                            {moment.caption && <p className="text-sm text-gray-700">{moment.caption}</p>}
                          </div>
                          <button onClick={() => deleteMoment(moment.id)} className="text-gray-400 hover:text-red-500 transition-colors p-1 flex-shrink-0" aria-label="Delete">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ════════════ MODALS ════════════ */}

      {/* Add Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Add Schedule Event</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Time</label>
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={e => setScheduleTime(e.target.value)}
                  className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Event Title</label>
                <input
                  type="text"
                  value={scheduleTitle}
                  onChange={e => setScheduleTitle(e.target.value)}
                  placeholder="e.g., Ceremony begins"
                  className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Location (Optional)</label>
                <input
                  type="text"
                  value={scheduleLocation}
                  onChange={e => setScheduleLocation(e.target.value)}
                  placeholder="e.g., Main Chapel"
                  className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowScheduleModal(false); setScheduleTitle(''); setScheduleTime(''); setScheduleLocation(''); }}
                className="flex-1 px-4 py-2.5 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={addScheduleEvent}
                disabled={!scheduleTime || !scheduleTitle.trim()}
                className={`flex-1 px-4 py-2.5 rounded-xl font-semibold transition-colors shadow-lg shadow-purple-200 ${
                  scheduleTime && scheduleTitle.trim()
                    ? 'bg-purple-600 text-white hover:bg-purple-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Schedule Modal */}
      {editingEvent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Edit Schedule Event</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Time</label>
                <input
                  type="time"
                  value={editTime}
                  onChange={e => setEditTime(e.target.value)}
                  className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Event Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Location (Optional)</label>
                <input
                  type="text"
                  value={editLocation}
                  onChange={e => setEditLocation(e.target.value)}
                  className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setEditingEvent(null)}
                className="flex-1 px-4 py-2.5 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveEditEvent}
                disabled={!editTime || !editTitle.trim()}
                className={`flex-1 px-4 py-2.5 rounded-xl font-semibold transition-colors shadow-lg shadow-purple-200 ${
                  editTime && editTitle.trim()
                    ? 'bg-purple-600 text-white hover:bg-purple-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}

export default function LivePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <LivePageContent />
    </Suspense>
  );
}
