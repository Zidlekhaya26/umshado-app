'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

interface Stats {
  totalVendors: number;
  pendingVerifications: number;
  totalCouples: number;
  totalPosts: number;
  proVendors: number;
  publishedVendors: number;
}

function StatCard({ label, value, href, accent }: { label: string; value: number | string; href?: string; accent?: string }) {
  const card = (
    <div style={{ background: '#1a1a1a', border: `1px solid ${accent ?? 'rgba(255,255,255,0.08)'}`, borderRadius: 14, padding: '20px 24px', transition: 'border-color .15s' }}>
      <p style={{ margin: '0 0 6px', fontSize: 11.5, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1 }}>{label}</p>
      <p style={{ margin: 0, fontSize: 32, fontWeight: 800, color: accent ?? '#fff', fontFamily: 'Georgia,serif' }}>{value}</p>
    </div>
  );
  return href ? <Link href={href} style={{ textDecoration: 'none', display: 'block' }}>{card}</Link> : card;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [
        { count: totalVendors },
        { count: pendingVerifications },
        { count: totalCouples },
        { count: totalPosts },
        { count: proVendors },
        { count: publishedVendors },
      ] = await Promise.all([
        supabase.from('vendors').select('*', { count: 'exact', head: true }),
        supabase.from('vendors').select('*', { count: 'exact', head: true }).eq('verification_status', 'paid_pending_review'),
        supabase.from('couples').select('*', { count: 'exact', head: true }),
        supabase.from('community_posts').select('*', { count: 'exact', head: true }),
        supabase.from('vendors').select('*', { count: 'exact', head: true }).in('subscription_tier', ['pro', 'trial']),
        supabase.from('vendors').select('*', { count: 'exact', head: true }).eq('is_published', true),
      ]);
      setStats({
        totalVendors: totalVendors ?? 0,
        pendingVerifications: pendingVerifications ?? 0,
        totalCouples: totalCouples ?? 0,
        totalPosts: totalPosts ?? 0,
        proVendors: proVendors ?? 0,
        publishedVendors: publishedVendors ?? 0,
      });
      setLoading(false);
    })();
  }, []);

  return (
    <div style={{ padding: '32px 36px', color: '#fff' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: '#9A2143', letterSpacing: 1.5, textTransform: 'uppercase' }}>Admin</p>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: '#fff', fontFamily: 'Georgia,serif' }}>Dashboard</h1>
      </div>

      {loading ? (
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>Loading stats...</p>
      ) : (
        <>
          {/* Alert — pending verifications */}
          {(stats?.pendingVerifications ?? 0) > 0 && (
            <Link href="/admin/verifications" style={{ textDecoration: 'none', display: 'block', marginBottom: 24 }}>
              <div style={{ padding: '14px 20px', borderRadius: 12, background: 'rgba(154,33,67,0.15)', border: '1.5px solid rgba(154,33,67,0.4)', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#9A2143', flexShrink: 0, animation: 'pulse 2s infinite' }} />
                <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: '#f87171' }}>
                  {stats?.pendingVerifications} vendor{stats?.pendingVerifications !== 1 ? 's' : ''} waiting for verification review
                </p>
                <span style={{ marginLeft: 'auto', fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Review →</span>
              </div>
            </Link>
          )}

          {/* Stats grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 40 }}>
            <StatCard label="Total Vendors" value={stats?.totalVendors ?? 0} href="/admin/vendors" />
            <StatCard label="Published Vendors" value={stats?.publishedVendors ?? 0} href="/admin/vendors" />
            <StatCard label="Pro / Trial" value={stats?.proVendors ?? 0} href="/admin/vendors" accent="#BD983F" />
            <StatCard label="Pending Verification" value={stats?.pendingVerifications ?? 0} href="/admin/verifications" accent={stats?.pendingVerifications ? '#9A2143' : undefined} />
            <StatCard label="Total Couples" value={stats?.totalCouples ?? 0} />
            <StatCard label="Community Posts" value={stats?.totalPosts ?? 0} href="/admin/posts" />
          </div>

          {/* Quick links */}
          <div>
            <p style={{ margin: '0 0 16px', fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1 }}>Quick Actions</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {[
                { href: '/admin/verifications', label: 'Review Verifications', desc: 'Approve or reject badge applications' },
                { href: '/admin/posts', label: 'Moderate Posts', desc: 'Remove inappropriate community posts' },
                { href: '/admin/vendors', label: 'Manage Vendors', desc: 'Edit tiers, publish status, verification' },
              ].map(a => (
                <Link key={a.href} href={a.href} style={{ textDecoration: 'none', flex: '1 1 240px' }}>
                  <div style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '18px 20px', transition: 'border-color .15s' }}>
                    <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: '#fff' }}>{a.label}</p>
                    <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{a.desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
