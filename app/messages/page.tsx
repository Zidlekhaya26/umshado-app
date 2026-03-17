'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import BottomNav from '@/components/BottomNav';
import VendorBottomNav from '@/components/VendorBottomNav';
import { useAuthRole } from '@/app/providers/AuthRoleProvider';

/* ─── Types ──────────────────────────────────────────────────────────── */
interface ConversationRow {
  id: string; couple_id: string; vendor_id: string;
  last_message_at: string | null; created_at: string;
}
interface ConversationItem {
  id: string; otherName: string; otherRole: 'vendor' | 'couple';
  logoUrl: string | null; lastMessageAt: string;
  lastMessagePreview: string | null; unread?: boolean;
}

/* ─── Helpers ────────────────────────────────────────────────────────── */
function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' });
}

const C = {
  crimson: 'var(--um-crimson)', crimsonDark: 'var(--um-crimson-dark)', crimsonDim: 'rgba(154,33,67,0.1)',
  gold: 'var(--um-gold)', goldDim: 'rgba(189,152,63,0.1)',
  dark: 'var(--um-dark)', bg: 'var(--um-ivory)', card: '#fff',
  border: '#f0ebe4', muted: 'var(--um-muted)', text: '#2d1a22',
};

/* ─── Avatar ─────────────────────────────────────────────────────────── */
function Avatar({ name, url, size = 52, showOnline = false }: {
  name: string; url: string | null; size?: number; showOnline?: boolean;
}) {
  const initials = name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <div style={{
        width: size, height: size, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
        background: `linear-gradient(135deg, ${C.crimson}, ${C.crimsonDark})`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: `2px solid ${C.crimsonDim}`, position: 'relative',
      }}>
        {url ? (
          <Image src={url} alt={name} fill style={{ objectFit: 'cover' }} />
        ) : (
          <span style={{ color: '#fff', fontWeight: 800, fontSize: size * 0.33, fontFamily: 'Georgia, serif' }}>{initials}</span>
        )}
      </div>
      {showOnline && (
        <div style={{ position: 'absolute', bottom: 1, right: 1, width: 11, height: 11, borderRadius: '50%', background: '#22c55e', border: '2px solid #fff' }} />
      )}
    </div>
  );
}

/* ─── Main ───────────────────────────────────────────────────────────── */
export default function MessagesIndex() {
  const router = useRouter();
  const { user, role } = useAuthRole();
  const [items, setItems] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isVendor, setIsVendor] = useState(false);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [isPublished, setIsPublished] = useState(false);
  useEffect(() => { setIsVendor(role === 'vendor'); }, [role]);
  useEffect(() => { loadConversations(); }, [user]);

  const loadConversations = async () => {
    try {
      setLoading(true);
      const u = user ?? null;
      if (!u) { setItems([]); return; }
      const activeRole = role ?? 'couple';
      setIsVendor(activeRole === 'vendor');

      let myVendorId: string | null = null;
      if (activeRole === 'vendor') {
        const { data: vRow } = await supabase.from('vendors').select('id,is_published')
          .eq('user_id', u.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (vRow) { myVendorId = vRow.id; setVendorId(vRow.id); setIsPublished(vRow.is_published || false); }
      }

      const roleFilter = activeRole === 'vendor'
        ? `vendor_id.eq.${myVendorId ?? u.id}`
        : `couple_id.eq.${u.id}`;

      const { data } = await supabase.from('conversations')
        .select('id,couple_id,vendor_id,last_message_at,created_at')
        .or(roleFilter).order('last_message_at', { ascending: false });

      const rows = (data || []) as ConversationRow[];
      if (rows.length === 0) { setItems([]); return; }

      const iAmVendor = activeRole === 'vendor';
      const convIds   = rows.map(r => r.id);
      const otherIds  = [...new Set(iAmVendor ? rows.map(r => r.couple_id) : rows.map(r => r.vendor_id))];

      // Batch fetch: last messages + other-party info in parallel (3 queries total)
      const [msgsRes, vendorRes, coupleRes, profileRes] = await Promise.all([
        supabase.from('messages')
          .select('conversation_id,message_text,read,sender_id,created_at')
          .in('conversation_id', convIds)
          .order('created_at', { ascending: false })
          .limit(convIds.length * 3),
        !iAmVendor
          ? supabase.from('vendors').select('id,business_name,logo_url').in('id', otherIds)
          : Promise.resolve({ data: [] }),
        iAmVendor
          ? supabase.from('couples').select('id,partner_name,avatar_url').in('id', otherIds)
          : Promise.resolve({ data: [] }),
        iAmVendor
          ? supabase.from('profiles').select('id,full_name').in('id', otherIds)
          : Promise.resolve({ data: [] }),
      ]);

      // Build lookup maps
      const lastMsgMap: Record<string, typeof msgsRes.data extends (infer T)[] | null ? T : never> = {};
      (msgsRes.data || []).forEach((m: any) => { if (!lastMsgMap[m.conversation_id]) lastMsgMap[m.conversation_id] = m; });

      const vendorMap: Record<string, any> = {};
      (vendorRes.data || []).forEach((v: any) => { vendorMap[v.id] = v; });

      const coupleMap: Record<string, any> = {};
      (coupleRes.data || []).forEach((c: any) => { coupleMap[c.id] = c; });

      const profileMap: Record<string, any> = {};
      (profileRes.data || []).forEach((p: any) => { profileMap[p.id] = p; });

      const resolved = rows.map(row => {
        const lastMsg = lastMsgMap[row.id] as any;
        const unread  = !!(lastMsg && lastMsg.read === false && lastMsg.sender_id !== u.id);

        if (iAmVendor) {
          const c = coupleMap[row.couple_id];
          const p = profileMap[row.couple_id];
          const coupleName = p?.full_name && c?.partner_name
            ? `${p.full_name} & ${c.partner_name}`
            : c?.partner_name || p?.full_name || 'Couple';
          return { id: row.id, otherName: coupleName, otherRole: 'couple' as const, logoUrl: c?.avatar_url || null, lastMessageAt: row.last_message_at || row.created_at, lastMessagePreview: lastMsg?.message_text || null, unread };
        }

        const v = vendorMap[row.vendor_id];
        return { id: row.id, otherName: v?.business_name || 'Vendor', otherRole: 'vendor' as const, logoUrl: v?.logo_url || null, lastMessageAt: row.last_message_at || row.created_at, lastMessagePreview: lastMsg?.message_text || null, unread };
      });

      setItems(resolved);
    } catch (err) { console.error(err); setItems([]); }
    finally { setLoading(false); }
  };

  // Realtime subscription — subscribe to couple_id and vendor_id so both roles get live updates
  useEffect(() => {
    if (!user) return;
    let ch = supabase.channel(`conv_user_${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations', filter: `couple_id=eq.${user.id}` }, () => loadConversations());
    if (vendorId) {
      ch = ch.on('postgres_changes', { event: '*', schema: 'public', table: 'conversations', filter: `vendor_id=eq.${vendorId}` }, () => loadConversations());
    }
    ch.subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, vendorId]);

  const handleShareProfile = async () => {
    if (!vendorId) return;
    const url = `${window.location.origin}/v/${vendorId}`;
    if (navigator.share) { try { await navigator.share({ title: 'uMshado Vendor Profile', url }); } catch {} }
    else { try { await navigator.clipboard.writeText(url); } catch {} }
  };

  /* ── Render ─────────────────────────────────────────────────────── */
  return (
    <div style={{ minHeight: '100svh', background: C.bg, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>

      <div style={{ maxWidth: 560, margin: '0 auto', paddingBottom: 96 }}>

        {/* ── Header ── */}
        <div style={{ background: `linear-gradient(160deg, var(--um-crimson-deep) 0%, ${C.crimson} 55%, var(--um-crimson-mid) 100%)`, padding: '20px 20px 24px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -50, right: -50, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(189,152,63,0.15) 0%, transparent 65%)', pointerEvents: 'none' }} />
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', position: 'relative' }}>
            <div>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4 }}>
                {isVendor ? 'Vendor' : 'Couple'} · Messages
              </p>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#fff', fontFamily: 'Georgia, serif', letterSpacing: -0.4 }}>
                Conversations
              </h1>
              {items.length > 0 && (
                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{items.length} thread{items.length !== 1 ? 's' : ''}</p>
              )}
            </div>
            {/* Gold ring icon */}
            <div style={{ width: 40, height: 40, borderRadius: '50%', border: '2px solid rgba(189,152,63,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" fill="none" stroke="rgba(189,152,63,0.8)" strokeWidth={1.6} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
          </div>
        </div>

        {/* ── List ── */}
        <div style={{ padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>

          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '8px 0' }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{ background: C.card, borderRadius: 18, padding: '16px', display: 'flex', gap: 14, alignItems: 'center', border: `1.5px solid ${C.border}`, opacity: 0.5 }}>
                  <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#f0e8e4' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ height: 14, background: '#f0e8e4', borderRadius: 6, width: '60%', marginBottom: 8 }} />
                    <div style={{ height: 11, background: '#f4efec', borderRadius: 5, width: '80%' }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && items.length === 0 && (
            <div style={{ background: C.card, borderRadius: 20, padding: '48px 24px', textAlign: 'center', border: `1.5px solid ${C.border}`, marginTop: 8 }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: C.crimsonDim, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <svg width="28" height="28" fill="none" stroke={C.crimson} strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 800, color: C.dark, fontFamily: 'Georgia, serif' }}>No conversations yet</h3>
              <p style={{ margin: '0 0 24px', fontSize: 13, color: C.muted, lineHeight: 1.5 }}>
                {isVendor
                  ? 'Couples will contact you here after viewing your profile or requesting a quote.'
                  : 'Browse vendors and start chatting!'}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 220, margin: '0 auto' }}>
                {isVendor ? (
                  isPublished && vendorId ? (
                    <>
                      <button onClick={handleShareProfile}
                        style={{ padding: '12px', borderRadius: 14, border: 'none', background: `linear-gradient(135deg, ${C.crimson}, ${C.crimsonDark})`, color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 14px rgba(154,33,67,0.25)' }}>
                        Share Profile
                      </button>
                      <Link href={`/v/${vendorId}?preview=1`}
                        style={{ padding: '12px', borderRadius: 14, border: `1.5px solid ${C.border}`, background: C.card, color: C.dark, fontSize: 13, fontWeight: 700, textAlign: 'center', textDecoration: 'none' }}>
                        View Public Profile
                      </Link>
                    </>
                  ) : (
                    <Link href="/vendor/review"
                      style={{ padding: '12px', borderRadius: 14, border: 'none', background: `linear-gradient(135deg, ${C.crimson}, ${C.crimsonDark})`, color: '#fff', fontSize: 13, fontWeight: 800, textAlign: 'center', textDecoration: 'none' }}>
                      Complete & Publish Profile
                    </Link>
                  )
                ) : (
                  <Link href="/marketplace"
                    style={{ padding: '12px', borderRadius: 14, border: 'none', background: `linear-gradient(135deg, ${C.crimson}, ${C.crimsonDark})`, color: '#fff', fontSize: 13, fontWeight: 800, textAlign: 'center', textDecoration: 'none' }}>
                    Browse Vendors
                  </Link>
                )}
              </div>
            </div>
          )}

          {items.map((item, idx) => (
            <button key={item.id}
              onClick={() => router.push(`/messages/thread/${item.id}`)}
              style={{
                width: '100%', textAlign: 'left', borderRadius: 18,
                border: `1.5px solid ${item.unread ? C.crimson : C.border}`,
                background: item.unread ? 'rgba(154,33,67,0.03)' : C.card,
                padding: '14px 16px',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14,
                boxShadow: item.unread ? '0 2px 12px rgba(154,33,67,0.10)' : '0 2px 10px rgba(26,13,18,0.04)',
                animation: `fadeUp 0.3s ease ${idx * 0.04}s both`,
                transition: 'transform 0.12s, box-shadow 0.12s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 20px rgba(154,33,67,0.10)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = ''; (e.currentTarget as HTMLButtonElement).style.boxShadow = item.unread ? '0 2px 12px rgba(154,33,67,0.10)' : '0 2px 10px rgba(26,13,18,0.04)'; }}
            >
              <Avatar name={item.otherName} url={item.logoUrl} size={52} />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: item.unread ? 800 : 700, color: C.dark, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.otherName}</p>
                  <span style={{ fontSize: 10, fontWeight: 600, color: item.unread ? C.crimson : C.muted, flexShrink: 0 }}>{timeAgo(item.lastMessageAt)}</span>
                </div>
                {item.lastMessagePreview ? (
                  <p style={{ margin: 0, fontSize: 12, color: item.unread ? C.dark : C.muted, fontWeight: item.unread ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.4 }}>{item.lastMessagePreview}</p>
                ) : (
                  <p style={{ margin: 0, fontSize: 12, color: '#c9b8c0', fontStyle: 'italic' }}>No messages yet</p>
                )}
              </div>

              {/* Unread dot or chevron */}
              {item.unread ? (
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: C.crimson, flexShrink: 0 }} />
              ) : (
                <svg width="14" height="14" fill="none" stroke={C.muted} strokeWidth={2} viewBox="0 0 24 24" style={{ flexShrink: 0, opacity: 0.5 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              )}
            </button>
          ))}
        </div>

        {/* ── Bottom CTA ── */}
        {!loading && items.length > 0 && (
          <div style={{ padding: '0 14px 12px' }}>
            {isVendor ? (
              isPublished && vendorId ? (
                <button onClick={handleShareProfile}
                  style={{ width: '100%', padding: '14px', borderRadius: 16, border: 'none', background: `linear-gradient(135deg, ${C.crimson}, ${C.crimsonDark})`, color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 16px rgba(154,33,67,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                  Share Profile
                </button>
              ) : null
            ) : (
              <Link href="/marketplace"
                style={{ display: 'block', width: '100%', padding: '14px', borderRadius: 16, background: `linear-gradient(135deg, ${C.crimson}, ${C.crimsonDark})`, color: '#fff', fontSize: 14, fontWeight: 800, textAlign: 'center', textDecoration: 'none', boxShadow: '0 4px 16px rgba(154,33,67,0.25)', boxSizing: 'border-box' }}>
                Browse Vendors
              </Link>
            )}
          </div>
        )}
      </div>

      {isVendor ? <VendorBottomNav /> : <BottomNav />}
    </div>
  );
}
