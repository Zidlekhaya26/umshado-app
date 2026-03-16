'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuthRole } from '@/app/providers/AuthRoleProvider';

export default function VendorBottomNav() {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasCouple, setHasCouple]     = useState(false);
  const { user } = useAuthRole();

  useEffect(() => {
    if (!user) { setUnreadCount(0); return; }
    let mounted = true;
    (async () => {
      try {
        const { count } = await supabase.from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id).eq('is_read', false);
        if (mounted) setUnreadCount(count || 0);
      } catch {}
    })();
    return () => { mounted = false; };
  }, [user]);

  useEffect(() => {
    if (!user) { setHasCouple(false); return; }
    let mounted = true;
    (async () => {
      try {
        const { data } = await supabase.from('profiles')
          .select('has_couple').eq('id', user.id).maybeSingle();
        if (mounted) setHasCouple(Boolean(data?.has_couple));
      } catch {}
    })();
    return () => { mounted = false; };
  }, [user]);

  const navItems = [
    {
      name: 'Dashboard', href: '/vendor/dashboard',
      icon: (active: boolean) => (
        <svg width="22" height="22" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 0 : 2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      name: 'Insights', href: '/vendor/insights',
      icon: (active: boolean) => (
        <svg width="22" height="22" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 0 : 2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      name: 'Bookings', href: '/vendor/bookings',
      icon: (active: boolean) => (
        <svg width="22" height="22" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 0 : 2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      name: 'Inbox', href: '/vendor/inbox',
      icon: (active: boolean) => (
        <div style={{ position: 'relative' }}>
          <svg width="22" height="22" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 0 : 2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          {unreadCount > 0 && (
            <span style={{ position: 'absolute', top: -5, right: -6, minWidth: 16, height: 16, borderRadius: 8, background: '#BD983F', color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px', lineHeight: 1 }}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
      ),
    },
    {
      name: 'Marketplace', href: '/marketplace',
      icon: (active: boolean) => (
        <svg width="22" height="22" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 0 : 2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
    },
    {
      name: 'Profile', href: '/vendor/media',
      icon: (active: boolean) => (
        <svg width="22" height="22" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 0 : 2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
  ];

  const isActive = (href: string) => {
    if (href === '/vendor/inbox')    return pathname.startsWith('/vendor/inbox') || pathname.startsWith('/messages') || pathname === '/notifications';
    if (href === '/marketplace')     return pathname.startsWith('/marketplace');
    if (href === '/vendor/bookings') return pathname.startsWith('/vendor/bookings');
    if (href === '/vendor/media')    return ['/vendor/media','/vendor/services','/vendor/packages','/vendor/review'].includes(pathname);
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '1px solid rgba(154,33,67,0.1)', zIndex: 50, boxShadow: '0 -2px 16px rgba(26,13,18,0.08)' }}>
      {/* Role switcher — only for dual-role users */}
      {hasCouple && (
        <div style={{ borderBottom: '1px solid rgba(154,33,67,0.08)', padding: '5px 12px' }}>
          <Link href="/switch-role" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            padding: '7px 16px', borderRadius: 10, textDecoration: 'none',
            background: 'rgba(154,33,67,0.06)', border: '1.5px solid rgba(154,33,67,0.15)',
          }}>
            <svg width="13" height="13" fill="none" stroke="#9A2143" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
            </svg>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#9A2143', letterSpacing: .2 }}>Switch to Couple view</span>
          </Link>
        </div>
      )}
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '7px 4px', paddingBottom: 'calc(7px + env(safe-area-inset-bottom))' }}>
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link key={item.name} href={item.href} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: '5px 10px', borderRadius: 12, minWidth: 48, textDecoration: 'none',
                color: active ? '#9A2143' : '#7a5060', transition: 'color 0.15s',
              }}>
                {item.icon(active)}
                <span style={{ fontSize: 9.5, marginTop: 3, fontWeight: active ? 700 : 500, letterSpacing: 0.2 }}>{item.name}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
