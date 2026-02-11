'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { UmshadoIcon } from '@/components/ui/UmshadoLogo';
import BottomNav from '@/components/BottomNav';
import VendorBottomNav from '@/components/VendorBottomNav';

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export default function NotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [isVendor, setIsVendor] = useState(false);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setItems([]);
        return;
      }

      // Detect role for nav
      const { data: profileData } = await supabase.from('profiles').select('active_role').eq('id', user.id).maybeSingle();
      setIsVendor(profileData?.active_role === 'vendor');

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading notifications:', error);
        return;
      }

      setItems(data || []);
    } catch (err) {
      console.error('Unexpected error loading notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = async (item: NotificationItem) => {
    try {
      if (!item.is_read) {
        await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('id', item.id);

        setItems((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n))
        );
      }

      if (item.link) {
        router.push(item.link);
      }
    } catch (err) {
      console.error('Error opening notification:', err);
    }
  };

  const handleMarkAllRead = async () => {
    const unread = items.filter((n) => !n.is_read);
    if (unread.length === 0) return;

    setMarkingAll(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) {
        console.error('Error marking all as read:', error);
        return;
      }

      setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (err) {
      console.error('Error marking all as read:', err);
    } finally {
      setMarkingAll(false);
    }
  };

  const unreadCount = items.filter((n) => !n.is_read).length;

  /* ── Time-ago helper ────────────────────────────────────────── */
  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' });
  };

  /* ── Icon per notification type ──────────────────────────────── */
  const typeIcon = (type: string) => {
    switch (type) {
      case 'quote_created':
      case 'quote_requested':
        return '📝';
      case 'quote_status_updated':
      case 'quote_updated':
        return '💰';
      case 'message_received':
      case 'message':
        return '💬';
      case 'vendor_published':
        return '🎉';
      case 'invite_approved':
        return '🎊';
      default:
        return '🔔';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full max-w-screen-xl mx-auto min-h-screen flex flex-col pb-24 px-4">
        <div className="bg-white border-b border-gray-200 px-4 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <UmshadoIcon size={28} />
              <div>
                <h1 className="text-xl font-bold text-gray-900">Notifications</h1>
                <p className="text-sm text-gray-600 mt-0.5">
                  {unreadCount > 0
                    ? `${unreadCount} unread`
                    : 'Your latest updates'}
                </p>
              </div>
            </div>

            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                disabled={markingAll}
                className="text-sm font-semibold text-purple-600 hover:text-purple-700 disabled:opacity-50"
              >
                {markingAll ? 'Marking…' : 'Mark all read'}
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 px-4 py-5 space-y-3 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!loading && items.length === 0 && (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-gray-900 mb-1">No notifications yet</h3>
              <p className="text-sm text-gray-600">
                You&apos;ll see updates here when you receive quotes, messages, or status changes.
              </p>
            </div>
          )}

          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => handleOpen(item)}
              className={`w-full text-left rounded-xl border-2 p-4 transition-colors ${
                item.is_read
                  ? 'border-gray-200 bg-white hover:bg-gray-50'
                  : 'border-purple-200 bg-purple-50 hover:bg-purple-100'
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-xl flex-shrink-0 mt-0.5">{typeIcon(item.type)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                    {!item.is_read && (
                      <span className="mt-1 inline-flex h-2 w-2 rounded-full bg-purple-600 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-gray-600 mt-1 line-clamp-2">{item.body}</p>
                  <p className="text-xs text-gray-400 mt-2">{timeAgo(item.created_at)}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {isVendor ? <VendorBottomNav /> : <BottomNav />}
    </div>
  );
}