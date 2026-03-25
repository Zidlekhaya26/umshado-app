'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { href: '/admin/verifications', label: 'Verifications', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
  { href: '/admin/posts', label: 'Posts', icon: 'M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z' },
  { href: '/admin/vendors', label: 'Vendors', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div style={{ minHeight: '100svh', background: '#0f0f0f', fontFamily: "'DM Sans',system-ui,sans-serif", display: 'flex' }}>
      {/* Sidebar */}
      <aside style={{ width: 220, background: '#1a0d12', borderRight: '1px solid rgba(154,33,67,0.2)', display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, bottom: 0, left: 0, zIndex: 10 }}>
        <div style={{ padding: '20px 18px 16px', borderBottom: '1px solid rgba(154,33,67,0.15)' }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: '#9A2143', letterSpacing: 1.5, textTransform: 'uppercase' }}>uMshado</p>
          <p style={{ margin: '2px 0 0', fontSize: 16, fontWeight: 800, color: '#fff', fontFamily: 'Georgia,serif' }}>Admin Panel</p>
        </div>
        <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV.map(item => {
            const active = item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10,
                textDecoration: 'none', color: active ? '#fff' : 'rgba(255,255,255,0.5)',
                background: active ? 'rgba(154,33,67,0.25)' : 'transparent',
                borderLeft: active ? '2.5px solid #9A2143' : '2.5px solid transparent',
                fontSize: 13.5, fontWeight: active ? 700 : 500, transition: 'all .15s',
              }}>
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                </svg>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div style={{ padding: '14px 18px', borderTop: '1px solid rgba(154,33,67,0.15)' }}>
          <Link href="/" style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>← Back to app</Link>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, marginLeft: 220, minHeight: '100svh', overflowY: 'auto' }}>
        {children}
      </main>
    </div>
  );
}
