'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface Vendor {
  id: string;
  business_name: string;
  category: string;
  location: string | null;
  subscription_tier: string | null;
  verified: boolean;
  verification_status: string | null;
  is_published: boolean;
  created_at: string;
}

const TIER_COLORS: Record<string, string> = {
  pro: '#BD983F',
  trial: '#8b5cf6',
  free: '#6b7280',
};

async function getToken() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? '';
}

export default function AdminVendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'pro' | 'verified' | 'unpublished'>('all');

  useEffect(() => {
    (async () => {
      const token = await getToken();
      const res = await fetch('/api/admin/vendors', {
        headers: { authorization: `Bearer ${token}` },
      });
      const j = await res.json();
      setVendors(j.vendors ?? []);
      setLoading(false);
    })();
  }, []);

  const patch = async (vendorId: string, update: Record<string, unknown>) => {
    setSaving(vendorId);
    const token = await getToken();
    await fetch('/api/admin/vendors', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ vendorId, update }),
    });
    setVendors(prev => prev.map(v => v.id === vendorId ? { ...v, ...update } : v));
    setSaving(null);
  };

  const filtered = vendors.filter(v => {
    const q = search.toLowerCase();
    const matchSearch = !q || v.business_name.toLowerCase().includes(q) || v.category.toLowerCase().includes(q) || (v.location ?? '').toLowerCase().includes(q);
    const matchFilter =
      filter === 'all' ? true :
      filter === 'pro' ? (v.subscription_tier === 'pro' || v.subscription_tier === 'trial') :
      filter === 'verified' ? v.verified :
      filter === 'unpublished' ? !v.is_published : true;
    return matchSearch && matchFilter;
  });

  return (
    <div style={{ padding: '32px 36px', color: '#fff', maxWidth: 1100 }}>
      <div style={{ marginBottom: 24 }}>
        <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: '#9A2143', letterSpacing: 1.5, textTransform: 'uppercase' }}>Admin</p>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, fontFamily: 'Georgia,serif' }}>Vendor Management</h1>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>{vendors.length} vendors total</p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search name, category, location..."
          style={{ flex: '1 1 240px', padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: '#1a1a1a', color: '#fff', fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
        />
        {(['all', 'pro', 'verified', 'unpublished'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: filter === f ? '#9A2143' : '#1a1a1a', color: filter === f ? '#fff' : 'rgba(255,255,255,0.5)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', textTransform: 'capitalize' }}>
            {f}
          </button>
        ))}
      </div>

      {loading && <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>Loading...</p>}

      {/* Table */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map(v => (
          <div key={v.id} style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            {/* Info */}
            <div style={{ flex: '1 1 200px', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.business_name}</p>
                {v.verified && (
                  <span style={{ fontSize: 9.5, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: 'rgba(37,99,235,0.2)', color: '#60a5fa' }}>VERIFIED</span>
                )}
              </div>
              <p style={{ margin: 0, fontSize: 11.5, color: 'rgba(255,255,255,0.4)' }}>
                {v.category}{v.location ? ` · ${v.location}` : ''}
              </p>
            </div>

            {/* Tier selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap' }}>Tier:</span>
              <select
                value={v.subscription_tier ?? 'free'}
                disabled={saving === v.id}
                onChange={e => patch(v.id, { subscription_tier: e.target.value })}
                style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${TIER_COLORS[v.subscription_tier ?? 'free'] ?? '#6b7280'}44`, background: '#0f0f0f', color: TIER_COLORS[v.subscription_tier ?? 'free'] ?? '#9ca3af', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
                <option value="free">Free</option>
                <option value="trial">Trial</option>
                <option value="pro">Pro</option>
              </select>
            </div>

            {/* Published toggle */}
            <button
              onClick={() => patch(v.id, { is_published: !v.is_published })}
              disabled={saving === v.id}
              style={{ padding: '6px 14px', borderRadius: 8, border: `1.5px solid ${v.is_published ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.15)'}`, background: 'transparent', color: v.is_published ? '#34d399' : 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
              {v.is_published ? 'Published' : 'Unpublished'}
            </button>

            {/* Verify toggle */}
            <button
              onClick={() => patch(v.id, { verified: !v.verified, verification_status: !v.verified ? 'approved' : 'none' })}
              disabled={saving === v.id}
              style={{ padding: '6px 14px', borderRadius: 8, border: `1.5px solid ${v.verified ? 'rgba(37,99,235,0.5)' : 'rgba(255,255,255,0.15)'}`, background: 'transparent', color: v.verified ? '#60a5fa' : 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
              {saving === v.id ? '...' : v.verified ? 'Verified' : 'Unverified'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
