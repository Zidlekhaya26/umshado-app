'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface PendingVendor {
  id: string;
  business_name: string;
  category: string;
  location: string | null;
  about: string | null;
  contact: Record<string, string> | null;
  verification_paid_at: string | null;
  subscription_tier: string | null;
  is_published: boolean;
}

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

async function getToken() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? '';
}

export default function AdminVerificationsPage() {
  const [vendors, setVendors] = useState<PendingVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, 'approved' | 'rejected'>>({});

  useEffect(() => {
    (async () => {
      const token = await getToken();
      const res = await fetch('/api/admin/verifications', {
        headers: { authorization: `Bearer ${token}` },
      });
      const j = await res.json();
      setVendors(j.vendors ?? []);
      setLoading(false);
    })();
  }, []);

  const act = async (vendorId: string, action: 'approve' | 'reject') => {
    setActing(vendorId);
    const token = await getToken();
    await fetch('/api/admin/verifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ vendorId, action }),
    });
    setDone(prev => ({ ...prev, [vendorId]: action === 'approve' ? 'approved' : 'rejected' }));
    setActing(null);
  };

  const pending = vendors.filter(v => !done[v.id]);
  const resolved = vendors.filter(v => !!done[v.id]);

  return (
    <div style={{ padding: '32px 36px', color: '#fff', maxWidth: 900 }}>
      <div style={{ marginBottom: 28 }}>
        <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: '#9A2143', letterSpacing: 1.5, textTransform: 'uppercase' }}>Admin</p>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, fontFamily: 'Georgia,serif' }}>Verification Queue</h1>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Review vendors who paid the R99 badge fee</p>
      </div>

      {loading && <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>Loading...</p>}

      {!loading && pending.length === 0 && resolved.length === 0 && (
        <div style={{ padding: '48px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14 }}>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, margin: 0 }}>No pending verifications</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {pending.map(v => (
          <div key={v.id} style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{v.business_name}</h3>
                  {v.subscription_tier && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: v.subscription_tier === 'pro' ? 'rgba(189,152,63,0.2)' : 'rgba(255,255,255,0.08)', color: v.subscription_tier === 'pro' ? '#BD983F' : '#9ca3af' }}>
                      {v.subscription_tier.toUpperCase()}
                    </span>
                  )}
                  {!v.is_published && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>UNPUBLISHED</span>
                  )}
                </div>
                <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                  {v.category}{v.location ? ` · ${v.location}` : ''}{v.verification_paid_at ? ` · Paid ${timeAgo(v.verification_paid_at)}` : ''}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => act(v.id, 'reject')} disabled={acting === v.id}
                  style={{ padding: '9px 18px', borderRadius: 10, border: '1.5px solid rgba(239,68,68,0.5)', background: 'transparent', color: '#f87171', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Reject
                </button>
                <button onClick={() => act(v.id, 'approve')} disabled={acting === v.id}
                  style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#1e3a8a,#2563eb)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: acting === v.id ? 0.6 : 1 }}>
                  {acting === v.id ? 'Saving...' : 'Approve Badge'}
                </button>
              </div>
            </div>
            <div style={{ padding: '14px 20px' }}>
              {v.about && (
                <p style={{ margin: '0 0 8px', fontSize: 12.5, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>
                  {v.about.slice(0, 300)}{v.about.length > 300 ? '...' : ''}
                </p>
              )}
              {v.contact?.whatsapp && (
                <p style={{ margin: 0, fontSize: 11.5, color: 'rgba(255,255,255,0.3)' }}>WhatsApp: {v.contact.whatsapp}</p>
              )}
            </div>
          </div>
        ))}

        {resolved.length > 0 && (
          <>
            <p style={{ margin: '8px 0 4px', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 1 }}>Actioned this session</p>
            {resolved.map(v => (
              <div key={v.id} style={{ background: '#141414', border: `1px solid ${done[v.id] === 'approved' ? 'rgba(37,99,235,0.3)' : 'rgba(239,68,68,0.2)'}`, borderRadius: 14, padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: 0.7 }}>
                <div>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{v.business_name}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'rgba(255,255,255,0.4)' }}>{v.category}</p>
                </div>
                <span style={{ fontSize: 11, fontWeight: 800, padding: '4px 12px', borderRadius: 20, background: done[v.id] === 'approved' ? 'rgba(37,99,235,0.2)' : 'rgba(239,68,68,0.15)', color: done[v.id] === 'approved' ? '#60a5fa' : '#f87171' }}>
                  {done[v.id] === 'approved' ? 'APPROVED' : 'REJECTED'}
                </span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
