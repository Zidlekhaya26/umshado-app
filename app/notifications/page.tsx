'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useAuthRole } from '@/app/providers/AuthRoleProvider';
import { UmshadoIcon } from '@/components/ui/UmshadoLogo';
import BottomNav from '@/components/BottomNav';
import VendorBottomNav from '@/components/VendorBottomNav';
import { CR, MUT, BOR, BG } from '@/lib/tokens';

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
  const { user, role } = useAuthRole();
  const [isVendor, setIsVendor] = useState(role === 'vendor');
  const u = user ?? null;

  useEffect(() => {
    loadNotifications();
  }, [u?.id]); // re-fetch when auth resolves

  const loadNotifications = async () => {
    try {
      setLoading(true);
      if (!u) {
        setItems([]);
        return;
      }
      setIsVendor((role ?? 'couple') === 'vendor');

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', u.id)
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
      if (!u) return;

      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', u.id)
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
      case 'booking_confirmed':
        return '📅';
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

  const DARK = 'var(--um-dark)', MUT = 'var(--um-muted)', BG = 'var(--um-ivory)', BOR = 'rgba(154,33,67,0.1)';

  return (
    <div style={{ minHeight: '100svh', background: BG, fontFamily: 'system-ui, sans-serif' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <div style={{ maxWidth: 600, margin: '0 auto', paddingBottom: 100 }}>

        {/* Header */}
        <div style={{ background: `linear-gradient(160deg,var(--um-crimson-deep) 0%,${CR} 55%,var(--um-crimson-mid) 100%)`, padding: '22px 20px 20px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -40, right: -40, width: 150, height: 150, borderRadius: '50%', background: 'rgba(189,152,63,0.1)', pointerEvents: 'none' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <UmshadoIcon size={28} />
              <div>
                <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#fff', fontFamily: 'Georgia,serif' }}>Notifications</h1>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
                  {unreadCount > 0 ? `${unreadCount} unread` : 'Your latest updates'}
                </p>
              </div>
            </div>
            {unreadCount > 0 && (
              <button onClick={handleMarkAllRead} disabled={markingAll}
                style={{ padding: '7px 14px', borderRadius: 20, border: '1.5px solid rgba(255,255,255,0.22)', background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: markingAll ? 'default' : 'pointer', opacity: markingAll ? 0.6 : 1 }}>
                {markingAll ? 'Marking…' : 'Mark all read'}
              </button>
            )}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>

          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', border: `3px solid rgba(154,33,67,0.15)`, borderTopColor: CR, animation: 'spin 0.8s linear infinite' }} />
            </div>
          )}

          {!loading && items.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(154,33,67,0.06)', border: `1.5px solid ${BOR}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 28 }}>🔔</div>
              <p style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: DARK, fontFamily: 'Georgia,serif' }}>No notifications yet</p>
              <p style={{ margin: 0, fontSize: 13, color: MUT, lineHeight: 1.5 }}>
                You&apos;ll see updates here when you receive quotes, messages, or bookings.
              </p>
            </div>
          )}

          {items.map((item) => (
            <button key={item.id} onClick={() => handleOpen(item)}
              style={{
                width: '100%', textAlign: 'left', borderRadius: 16,
                border: `1.5px solid ${item.is_read ? 'rgba(0,0,0,0.06)' : 'rgba(154,33,67,0.2)'}`,
                background: item.is_read ? '#fff' : 'rgba(154,33,67,0.04)',
                padding: 16, cursor: 'pointer', transition: 'background 0.12s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = item.is_read ? 'var(--um-ivory)' : 'rgba(154,33,67,0.07)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = item.is_read ? '#fff' : 'rgba(154,33,67,0.04)'; }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: item.is_read ? 'rgba(0,0,0,0.04)' : 'rgba(154,33,67,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                  {typeIcon(item.type)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 3 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: item.is_read ? 600 : 700, color: DARK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</p>
                    {!item.is_read && (
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: CR, flexShrink: 0, marginTop: 3 }} />
                    )}
                  </div>
                  <p style={{ margin: '0 0 5px', fontSize: 11, color: MUT, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as React.CSSProperties}>{item.body}</p>
                  <p style={{ margin: 0, fontSize: 10, color: '#b0a090' }}>{timeAgo(item.created_at)}</p>
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