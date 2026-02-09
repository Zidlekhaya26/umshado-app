'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, Suspense, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';

// ─── Types ───────────────────────────────────────────────

interface ScheduleEvent {
  id: string;
  title: string;
  time: string;
  location: string | null;
  sort_order: number;
}

interface WellWish {
  id: string;
  guest_name: string;
  message: string;
  created_at: string;
}

interface Moment {
  id: string;
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

// ─── Main Guest Content ─────────────────────────────────

function GuestPageContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [coupleNames, setCoupleNames] = useState('The Happy Couple');
  const [schedule, setSchedule] = useState<ScheduleEvent[]>([]);
  const [wishes, setWishes] = useState<WellWish[]>([]);
  const [moments, setMoments] = useState<Moment[]>([]);

  // Guest name (stored in localStorage)
  const [guestName, setGuestName] = useState('');
  const [nameSet, setNameSet] = useState(false);

  // Well wish form
  const [wishMessage, setWishMessage] = useState('');
  const [sendingWish, setSendingWish] = useState(false);

  // Moment form
  const [showMomentForm, setShowMomentForm] = useState(false);
  const [momentCaption, setMomentCaption] = useState('');
  const [momentUrl, setMomentUrl] = useState('');
  const [sendingMoment, setSendingMoment] = useState(false);

  // Active tab
  const [activeTab, setActiveTab] = useState<'schedule' | 'wishes' | 'moments'>('schedule');

  // Load guest name from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('umshado_guest_name');
      if (saved) {
        setGuestName(saved);
        setNameSet(true);
      }
    } catch {
      // ignore
    }
  }, []);

  // Load all data from the guest API
  const loadData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/live/guest?token=${token}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Invalid or expired link');
        setLoading(false);
        return;
      }
      const data = await res.json();
      setCoupleNames(data.couple?.names || 'The Happy Couple');
      setSchedule(data.schedule || []);
      setWishes(data.wishes || []);
      setMoments(data.moments || []);
    } catch {
      setError('Failed to load. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadData(); }, [loadData]);

  // Save guest name
  const saveGuestName = () => {
    if (!guestName.trim()) return;
    try {
      localStorage.setItem('umshado_guest_name', guestName.trim());
    } catch {
      // ignore
    }
    setNameSet(true);
  };

  // Send well wish
  const sendWish = async () => {
    if (!wishMessage.trim() || !token || sendingWish) return;
    setSendingWish(true);
    try {
      const res = await fetch('/api/live/wish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, guest_name: guestName, message: wishMessage.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setWishes(prev => [data.wish, ...prev]);
        setWishMessage('');
      } else {
        alert('Failed to send wish. Please try again.');
      }
    } catch {
      alert('Failed to send. Check your connection.');
    } finally {
      setSendingWish(false);
    }
  };

  // Send moment
  const sendMoment = async () => {
    if ((!momentCaption.trim() && !momentUrl.trim()) || !token || sendingMoment) return;
    setSendingMoment(true);
    try {
      const res = await fetch('/api/live/moment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          guest_name: guestName,
          caption: momentCaption.trim() || null,
          media_url: momentUrl.trim() || null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setMoments(prev => [data.moment, ...prev]);
        setMomentCaption(''); setMomentUrl('');
        setShowMomentForm(false);
      } else {
        alert('Failed to share moment. Please try again.');
      }
    } catch {
      alert('Failed to share. Check your connection.');
    } finally {
      setSendingMoment(false);
    }
  };

  // ─── No token ──────────────────────────────────────────

  if (!token) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <span className="text-4xl mb-4 block">🔗</span>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Invalid Link</h1>
          <p className="text-sm text-gray-600">This guest link is missing or invalid. Please ask the couple for a new link.</p>
        </div>
      </div>
    );
  }

  // ─── Loading ───────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-gray-600">Loading wedding details...</p>
        </div>
      </div>
    );
  }

  // ─── Error ─────────────────────────────────────────────

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <span className="text-4xl mb-4 block">⚠️</span>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Oops!</h1>
          <p className="text-sm text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  // ─── Name entry ────────────────────────────────────────

  if (!nameSet) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-pink-50 flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-white rounded-2xl shadow-lg p-8">
          <div className="text-center mb-6">
            <span className="text-4xl mb-3 block">💒</span>
            <h1 className="text-xl font-bold text-gray-900 mb-1">{coupleNames}</h1>
            <p className="text-sm text-gray-600">Welcome to the wedding!</p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Your Name</label>
              <input
                type="text"
                value={guestName}
                onChange={e => setGuestName(e.target.value)}
                placeholder="Enter your name"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 text-base"
                onKeyDown={(e) => e.key === 'Enter' && saveGuestName()}
                autoFocus
              />
            </div>
            <button
              onClick={saveGuestName}
              disabled={!guestName.trim()}
              className={`w-full py-3 rounded-xl font-semibold text-base transition-all ${
                guestName.trim()
                  ? 'bg-purple-600 text-white hover:bg-purple-700 shadow-lg shadow-purple-200'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Main guest UI ─────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto min-h-screen bg-white shadow-lg flex flex-col">

        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-500 text-white px-4 py-5 shadow-lg">
          <p className="text-xs font-medium opacity-80 uppercase tracking-wider">Celebrating</p>
          <h1 className="text-xl font-bold mt-1">{coupleNames}</h1>
          <p className="text-sm opacity-90 mt-1">Welcome, {guestName} 🎉</p>
        </div>

        {/* Tab Pills */}
        <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10">
          <div className="flex gap-2">
            {[
              { key: 'schedule', label: '🗓️ Schedule' },
              { key: 'wishes', label: '💌 Wishes' },
              { key: 'moments', label: '📸 Moments' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as 'schedule' | 'wishes' | 'moments')}
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-gray-50">

          {/* ═══ SCHEDULE ═══ */}
          {activeTab === 'schedule' && (
            <div className="p-4">
              <h2 className="text-base font-bold text-gray-900 mb-3">Wedding Day Schedule</h2>
              {schedule.length === 0 ? (
                <div className="bg-white rounded-xl border-2 border-dashed border-gray-300 p-8 text-center">
                  <span className="text-3xl mb-2 block">🗓️</span>
                  <p className="text-sm text-gray-600">Schedule coming soon!</p>
                </div>
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
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═══ WELL WISHES ═══ */}
          {activeTab === 'wishes' && (
            <div className="p-4 space-y-4">
              <h2 className="text-base font-bold text-gray-900">Send a Well Wish</h2>

              {/* Compose */}
              <div className="bg-white rounded-xl border-2 border-gray-200 p-4 space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={wishMessage}
                    onChange={(e) => setWishMessage(e.target.value)}
                    placeholder="Write your congratulations..."
                    className="flex-1 px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm text-gray-900"
                    onKeyDown={(e) => e.key === 'Enter' && sendWish()}
                  />
                  <button
                    onClick={sendWish}
                    disabled={!wishMessage.trim() || sendingWish}
                    className={`px-5 py-2.5 rounded-xl font-semibold transition-colors shadow-md ${
                      wishMessage.trim() && !sendingWish
                        ? 'bg-purple-600 text-white hover:bg-purple-700'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {sendingWish ? '...' : 'Send'}
                  </button>
                </div>
              </div>

              {/* Feed */}
              {wishes.length === 0 ? (
                <div className="text-center py-6">
                  <span className="text-3xl">💌</span>
                  <p className="text-sm text-gray-600 mt-2">No wishes yet. Be the first!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {wishes.map((wish) => (
                    <div key={wish.id} className="bg-white rounded-xl border border-gray-200 p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-bold text-gray-900">{wish.guest_name}</span>
                        <span className="text-xs text-gray-400">{timeAgo(wish.created_at)}</span>
                      </div>
                      <p className="text-sm text-gray-700">{wish.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═══ MOMENTS ═══ */}
          {activeTab === 'moments' && (
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-gray-900">Moments</h2>
                <button
                  onClick={() => setShowMomentForm(!showMomentForm)}
                  className="px-4 py-2 bg-purple-600 text-white rounded-full text-sm font-semibold hover:bg-purple-700 transition-colors shadow-md"
                >
                  {showMomentForm ? 'Cancel' : '+ Share'}
                </button>
              </div>

              {/* Moment form */}
              {showMomentForm && (
                <div className="bg-white rounded-xl border-2 border-purple-200 p-4 space-y-3">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Caption</label>
                    <input
                      type="text"
                      value={momentCaption}
                      onChange={e => setMomentCaption(e.target.value)}
                      placeholder="What's happening?"
                      className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Photo URL (optional)</label>
                    <input
                      type="url"
                      value={momentUrl}
                      onChange={e => setMomentUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm text-gray-900"
                    />
                  </div>
                  <button
                    onClick={sendMoment}
                    disabled={(!momentCaption.trim() && !momentUrl.trim()) || sendingMoment}
                    className={`w-full py-2.5 rounded-xl font-semibold transition-colors ${
                      (momentCaption.trim() || momentUrl.trim()) && !sendingMoment
                        ? 'bg-purple-600 text-white hover:bg-purple-700 shadow-lg shadow-purple-200'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {sendingMoment ? 'Sharing...' : 'Share Moment'}
                  </button>
                </div>
              )}

              {/* Moments feed */}
              {moments.length === 0 && !showMomentForm ? (
                <div className="text-center py-6">
                  <span className="text-3xl">📸</span>
                  <p className="text-sm text-gray-600 mt-2">No moments shared yet. Be the first!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {moments.map((moment) => (
                    <div key={moment.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      {moment.media_url && (
                        <div className="aspect-video bg-gray-100">
                          <img
                            src={moment.media_url}
                            alt={moment.caption || 'Moment'}
                            className="w-full h-full object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        </div>
                      )}
                      <div className="p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-bold text-gray-900">{moment.guest_name}</span>
                          <span className="text-xs text-gray-400">{timeAgo(moment.created_at)}</span>
                        </div>
                        {moment.caption && <p className="text-sm text-gray-700">{moment.caption}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function GuestLivePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <GuestPageContent />
    </Suspense>
  );
}
