'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuthRole } from '@/app/providers/AuthRoleProvider';

export default function BottomNav() {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount]     = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [hasVendor, setHasVendor]         = useState(false);
  const { user } = useAuthRole();

  // Track unread notifications — initial fetch + realtime updates
  useEffect(() => {
    if (!user) { setUnreadCount(0); return; }
    let mounted = true;

    const fetchCount = async () => {
      try {
        const { count } = await supabase
          .from('notifications').select('*', { count: 'exact', head: true })
          .eq('user_id', user.id).eq('is_read', false);
        if (mounted) setUnreadCount(count || 0);
      } catch { /* non-fatal */ }
    };

    fetchCount();

    // Subscribe to realtime inserts/updates so badge refreshes without a page reload
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => { fetchCount(); },
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Track unread messages — single filtered fetch + parallel counts (no N+1)
  useEffect(() => {
    if (!user) { setUnreadMessages(0); return; }
    let mounted = true;
    (async () => {
      try {
        // Only fetch conversations this user participates in
        const { data: convs } = await supabase
          .from('conversations')
          .select('id,last_message_at,last_read_at')
          .or(`couple_id.eq.${user.id},vendor_id.eq.${user.id}`);
        if (!convs || !mounted) return;

        // Keep only conversations that have new messages since last read
        const stale = convs.filter(c => {
          const lastMsg  = c.last_message_at ? new Date(c.last_message_at) : null;
          const lastRead = c.last_read_at    ? new Date(c.last_read_at)    : null;
          return lastMsg && (!lastRead || lastMsg > lastRead);
        });

        if (stale.length === 0) { if (mounted) setUnreadMessages(0); return; }

        // Fire all count queries in parallel — O(1 + N parallel) instead of O(N sequential)
        const counts = await Promise.all(
          stale.map(c =>
            supabase.from('messages')
              .select('*', { count: 'exact', head: true })
              .eq('conversation_id', c.id)
              .neq('sender_id', user.id)
              .gt('created_at', c.last_read_at || '1970-01-01')
          )
        );
        const total = counts.reduce((acc, { count }) => acc + (count || 0), 0);
        if (mounted) setUnreadMessages(total);
      } catch { /* non-fatal */ }
    })();
    return () => { mounted = false; };
  }, [user]);

  // Check if this user also has a vendor account
  useEffect(() => {
    if (!user) { setHasVendor(false); return; }
    let mounted = true;
    (async () => {
      try {
        const { data } = await supabase.from('profiles')
          .select('has_vendor').eq('id', user.id).maybeSingle();
        if (mounted) setHasVendor(Boolean(data?.has_vendor));
      } catch { /* non-fatal */ }
    })();
    return () => { mounted = false; };
  }, [user]);

  const navItems = [
    {
      name: 'Home', href: '/couple/dashboard',
      icon: (active: boolean) => (
        <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 0 : 2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      name: 'Planner', href: '/couple/planner',
      icon: (active: boolean) => (
        <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 0 : 2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      ),
    },
    {
      name: 'Marketplace', href: '/marketplace',
      icon: (active: boolean) => (
        <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 0 : 2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      ),
    },
    {
      name: 'Messages', href: '/messages',
      icon: (active: boolean) => (
        <div className="relative">
          <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 0 : 2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          {unreadMessages > 0 && (
            <span
              aria-label={`${unreadMessages} unread message${unreadMessages !== 1 ? 's' : ''}`}
              style={{ position:'absolute', top:-5, right:-6, minWidth:16, height:16, borderRadius:8, background:'var(--um-gold)', color:'#fff', fontSize:9, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 3px', lineHeight:1 }}
            >
              {unreadMessages > 99 ? '99+' : unreadMessages}
            </span>
          )}
        </div>
      ),
    },
    {
      name: 'Saved', href: '/couple/saved',
      icon: (active: boolean) => (
        <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 0 : 2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      ),
    },
    {
      name: 'Alerts', href: '/notifications',
      icon: (active: boolean) => (
        <div className="relative">
          <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 0 : 2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          {unreadCount > 0 && (
            <span
              aria-label={`${unreadCount} unread alert${unreadCount !== 1 ? 's' : ''}`}
              style={{ position:'absolute', top:-5, right:-6, minWidth:16, height:16, borderRadius:8, background:'var(--um-gold)', color:'#fff', fontSize:9, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 3px', lineHeight:1 }}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
      ),
    },
  ];

  const isActive = (href: string) => {
    if (href === '/marketplace') return pathname.startsWith('/marketplace');
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <nav id="um-couple-nav" aria-label="Main navigation" style={{ position:'fixed', bottom:0, left:0, right:0, background:'var(--surface)', borderTop:'1px solid var(--border-subtle)', zIndex:50, boxShadow:'0 -2px 16px rgba(0,0,0,0.1)' }}>
      <div className="um-nav-brand">
        <span style={{ fontSize:18, fontWeight:800, fontFamily:'Georgia,serif', color:'var(--um-crimson)' }}>uMshado</span>
      </div>
      {/* Role switcher chip — only shown to dual-role users */}
      {hasVendor && (
        <div className="um-nav-switcher" style={{ borderBottom: '1px solid rgba(154,33,67,0.1)', padding: '6px 12px' }}>
          <Link href="/switch-role" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            padding: '8px 16px', borderRadius: 10, textDecoration: 'none',
            background: 'rgba(154,33,67,0.07)', border: '1.5px solid rgba(154,33,67,0.18)',
          }}>
            <svg width="13" height="13" fill="none" stroke="var(--um-crimson)" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
            </svg>
            <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--um-crimson)', letterSpacing: .2 }}>Switch to Vendor view</span>
          </Link>
        </div>
      )}

      <div className="um-nav-main" style={{ maxWidth:520, margin:'0 auto' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-around', padding:'8px 4px', paddingBottom:'calc(8px + env(safe-area-inset-bottom))' }}>
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                aria-label={item.name}
                aria-current={active ? 'page' : undefined}
                style={{
                  display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                  padding:'6px 12px', borderRadius:12, minWidth:52, textDecoration:'none',
                  color: active ? 'var(--um-gold)' : 'var(--muted)', transition:'color 0.15s',
                }}
              >
                {item.icon(active)}
                <span aria-hidden="true" style={{ fontSize:10, marginTop:3, fontWeight: active ? 700 : 500, letterSpacing:0.2 }}>
                  {item.name}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
