'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuthRole } from '@/app/providers/AuthRoleProvider';

export default function VendorBottomNav() {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);
  const { user } = useAuthRole();

  useEffect(() => {
    if (!user) { setUnreadCount(0); return; }
    let mounted = true;
    (async () => {
      try {
        const { count } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('is_read', false);

        if (mounted) setUnreadCount(count || 0);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
        console.error('Error loading unread notifications:', err);
      }
    })();

    return () => { mounted = false; };
  }, [user]);

  const navItems = [
    {
      name: 'Dashboard',
      href: '/vendor/dashboard',
      icon: (active: boolean) => (
        <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 0 : 2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      name: 'Insights',
      href: '/vendor/insights',
      icon: (active: boolean) => (
        <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 0 : 2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      name: 'Chats',
      href: '/messages',
      icon: (active: boolean) => (
        <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 0 : 2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
    },
    {
      name: 'Alerts',
      href: '/notifications',
      icon: (active: boolean) => (
        <div className="relative">
          <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 0 : 2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-2 inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-white text-[10px] font-bold px-1 leading-none" style={{ background: '#9A2143' }}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
      ),
    },
    {
      name: 'Billing',
      href: '/vendor/billing',
      icon: (active: boolean) => (
        <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 0 : 2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
      ),
    },
    {
      name: 'Profile',
      href: '/vendor/media',
      icon: (active: boolean) => (
        <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 0 : 2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
  ];

  const isActive = (href: string) => {
    if (href === '/messages') return pathname.startsWith('/messages');
    if (href === '/vendor/billing') return pathname === '/vendor/billing';
    if (href === '/vendor/media') {
      // Active for any vendor sub-page that isn't dashboard/billing
      return pathname === '/vendor/media' || pathname === '/vendor/services' || pathname === '/vendor/packages' || pathname === '/vendor/review';
    }
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
      <div className="mx-auto w-full max-w-md lg:max-w-6xl lg:px-6">
        <div className="flex items-center justify-around px-2 py-2">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex flex-col items-center justify-center px-3 py-2 rounded-lg transition-colors min-w-[56px] ${
                  active
                    ? ''
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
                style={active ? { color: '#9A2143' } : {}}
              >
                {item.icon(active)}
                <span className={`text-[10px] mt-1 font-medium ${active ? 'font-semibold' : ''}`}>
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
