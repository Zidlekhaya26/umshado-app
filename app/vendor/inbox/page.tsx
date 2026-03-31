'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';
import { useAuthRole } from '@/app/providers/AuthRoleProvider';
import VendorBottomNav from '@/components/VendorBottomNav';
import { CR, CR2, CRX, GD, DK, MUT, BOR, BG } from '@/lib/tokens';

/* ─── Types ──────────────────────────────────────────────── */
interface Conversation {
  id: string;
  last_message_at: string | null;
  couple_id: string;
  couple_name: string;
  couple_avatar: string | null;
  unread: number;
  last_message: string | null;
  has_pending_quote: boolean;
}
interface NotifItem {
  id: string; type: string; title: string; body: string;
  link: string | null; is_read: boolean; created_at: string;
}
interface QuoteItem {
  id: string;
  quote_ref: string;
  status: 'requested' | 'negotiating' | 'accepted' | 'declined' | 'expired' | 'booked';
  package_name: string | null;
  base_from_price: number | null;
  vendor_final_price: number | null;
  created_at: string;
  couple_id: string;
  couple_name: string;
  couple_avatar: string | null;
  conversation_id: string | null;
}

/* ─── Tokens ─────────────────────────────────────────────── */

/* ─── Helpers ────────────────────────────────────────────── */
function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' });
}
function notifIcon(type: string) {
  switch (type) {
    case 'quote_created': case 'quote_requested': return '📝';
    case 'quote_status_updated': case 'quote_updated': return '💰';
    case 'booking_confirmed': return '📅';
    case 'message_received': case 'message': return '💬';
    case 'vendor_published': return '🎉';
    default: return '🔔';
  }
}

/* ─── Page ───────────────────────────────────────────────── */
export default function VendorInboxPage() {
  const router = useRouter();
  const { user } = useAuthRole();
  const [tab, setTab] = useState<'chats' | 'quotes' | 'alerts'>('chats');

  const [convs, setConvs] = useState<Conversation[]>([]);
  const [convLoading, setConvLoading] = useState(true);
  const [vendorId, setVendorId] = useState<string | null>(null);

  const [notifs, setNotifs] = useState<NotifItem[]>([]);
  const [notifsLoading, setNotifsLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  const [quotes, setQuotes] = useState<QuoteItem[]>([]);
  const [quotesLoading, setQuotesLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadAll(user.id);

    // Reload when the tab regains focus (e.g. user returns from a chat thread)
    const onFocus = () => loadAll(user.id);
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [user?.id]);

  const loadAll = async (uid: string) => {
    const { data: v } = await supabase.from('vendors').select('id').eq('user_id', uid).limit(1).maybeSingle();
    const vid = v?.id || uid;
    setVendorId(vid);
    await Promise.all([loadConvs(vid, uid), loadNotifs(uid), loadQuotes(vid)]);
  };

  const loadConvs = async (vid: string, uid: string) => {
    setConvLoading(true);
    try {
      const { data: convData } = await supabase
        .from('conversations')
        .select('id, last_message_at, last_read_at, couple_id')
        .eq('vendor_id', vid)
        .order('last_message_at', { ascending: false, nullsFirst: false });

      if (!convData?.length) { setConvs([]); return; }

      const convIds = convData.map((c: any) => c.id);
      const coupleIds = [...new Set(convData.map((c: any) => c.couple_id))];

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';
      const [{ data: msgs }, { data: pendingQuotes }, namesRes] = await Promise.all([
        supabase.from('messages')
          .select('conversation_id, message_text, read, sender_id, created_at')
          .in('conversation_id', convIds)
          .order('created_at', { ascending: false }),
        supabase.from('quotes').select('couple_id').eq('vendor_id', vid).eq('status', 'requested'),
        fetch('/api/vendor/couple-names', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ coupleIds }) }),
      ]);
      const namesJson = namesRes.ok ? await namesRes.json() : { couples: [], profiles: [] };

      const pendingCoupleIds = new Set((pendingQuotes || []).map((q: any) => q.couple_id));
      const coupleMap = new Map<string,{id:string;partner_name:string|null;avatar_url:string|null}>((namesJson.couples || []).map((c: any) => [c.id, c]));
      const profileMap = new Map<string,{id:string;full_name:string|null}>((namesJson.profiles || []).map((p: any) => [p.id, p]));
      const msgsByConv = new Map<string, any[]>();
      (msgs || []).forEach((m: any) => {
        if (!msgsByConv.has(m.conversation_id)) msgsByConv.set(m.conversation_id, []);
        msgsByConv.get(m.conversation_id)!.push(m);
      });

      setConvs(convData.map((c: any) => {
        const cMsgs = msgsByConv.get(c.id) || [];
        const couple = coupleMap.get(c.couple_id);
        return {
          id: c.id,
          last_message_at: c.last_message_at,
          couple_id: c.couple_id,
          couple_name: couple?.partner_name || profileMap.get(c.couple_id)?.full_name || 'Couple',
          couple_avatar: couple?.avatar_url || null,
          unread: cMsgs.filter((m: any) =>
            m.sender_id !== uid &&
            (!c.last_read_at || new Date(m.created_at) > new Date(c.last_read_at))
          ).length,
          last_message: cMsgs[0]?.message_text || null,
          has_pending_quote: pendingCoupleIds.has(c.couple_id),
        };
      }));
    } catch (err) { console.error('loadConvs:', err); }
    finally { setConvLoading(false); }
  };

  const loadQuotes = async (vid: string) => {
    setQuotesLoading(true);
    try {
      const { data: quoteData } = await supabase
        .from('quotes')
        .select('id, quote_ref, status, package_name, base_from_price, vendor_final_price, created_at, couple_id')
        .eq('vendor_id', vid)
        .order('created_at', { ascending: false });

      if (!quoteData?.length) { setQuotes([]); return; }

      const coupleIds = [...new Set(quoteData.map((q: any) => q.couple_id))];
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';
      const [{ data: convData }, namesRes] = await Promise.all([
        supabase.from('conversations').select('id, couple_id').eq('vendor_id', vid).in('couple_id', coupleIds),
        fetch('/api/vendor/couple-names', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ coupleIds }) }),
      ]);
      const namesJson = namesRes.ok ? await namesRes.json() : { couples: [], profiles: [] };

      const coupleMap = new Map<string,{id:string;partner_name:string|null;avatar_url:string|null}>((namesJson.couples || []).map((c: any) => [c.id, c]));
      const convMap = new Map((convData || []).map((c: any) => [c.couple_id, c.id]));
      const profileMap = new Map<string,{id:string;full_name:string|null}>((namesJson.profiles || []).map((p: any) => [p.id, p]));

      setQuotes(quoteData.map((q: any) => {
        const couple = coupleMap.get(q.couple_id);
        return {
          ...q,
          couple_name: couple?.partner_name || profileMap.get(q.couple_id)?.full_name || 'Couple',
          couple_avatar: couple?.avatar_url || null,
          conversation_id: convMap.get(q.couple_id) || null,
        };
      }));
    } catch (err) { console.error('loadQuotes:', err); }
    finally { setQuotesLoading(false); }
  };

  const loadNotifs = async (uid: string) => {
    setNotifsLoading(true);
    try {
      const { data } = await supabase.from('notifications')
        .select('*').eq('user_id', uid).order('created_at', { ascending: false });
      const items = (data || []) as NotifItem[];
      setNotifs(items);
      setUnreadAlerts(items.filter(n => !n.is_read).length);
    } catch (err) { console.error('loadNotifs:', err); }
    finally { setNotifsLoading(false); }
  };

  const handleOpenNotif = async (item: NotifItem) => {
    if (!item.is_read) {
      await supabase.from('notifications').update({ is_read: true }).eq('id', item.id);
      setNotifs(prev => prev.map(n => n.id === item.id ? { ...n, is_read: true } : n));
      setUnreadAlerts(prev => Math.max(0, prev - 1));
    }
    if (item.link) router.push(item.link);
  };

  const handleMarkAllRead = async () => {
    if (!user) return;
    setMarkingAll(true);
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadAlerts(0);
    setMarkingAll(false);
  };

  const unreadChats = convs.reduce((s, c) => s + c.unread, 0);
  const pendingQuoteCount = quotes.filter(q => q.status === 'requested').length;

  return (
    <div style={{ minHeight: '100svh', background: BG, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`
        @keyframes ibSpin { to { transform: rotate(360deg) } }
        @keyframes ibFade { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: translateY(0) } }
        button, a { font-family: inherit!important }
        .ib-conv:hover { background: #f5f0ec!important }
        .ib-notif:active { opacity: .85 }
      `}</style>

      <div style={{ maxWidth: 560, margin: '0 auto', paddingBottom: 100 }}>

        {/* Header + tabs */}
        <div style={{ background: `linear-gradient(160deg,${CRX} 0%,${CR} 55%,#c03050 100%)`, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', border: '1.5px solid rgba(189,152,63,0.12)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', top: -20, right: -20, width: 96, height: 96, borderRadius: '50%', border: '1.5px solid rgba(189,152,63,0.18)', pointerEvents: 'none' }} />
          <div style={{ padding: '20px 20px 0', position: 'relative' }}>
            <h1 style={{ margin: '0 0 2px', fontSize: 22, fontWeight: 800, color: '#fff', fontFamily: 'Georgia,serif', letterSpacing: -0.3 }}>Inbox</h1>
            <p style={{ margin: 0, fontSize: 11.5, color: 'rgba(255,255,255,0.55)' }}>
              {pendingQuoteCount > 0
                ? `${pendingQuoteCount} quote${pendingQuoteCount !== 1 ? 's' : ''} awaiting reply`
                : unreadChats + unreadAlerts > 0 ? `${unreadChats + unreadAlerts} unread` : 'All caught up'}
            </p>
          </div>
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.12)', marginTop: 16, position: 'relative' }}>
            {([['chats', 'Chats', unreadChats, CR2, '#fff'], ['quotes', 'Quotes', pendingQuoteCount, '#2563eb', '#fff'], ['alerts', 'Alerts', unreadAlerts, GD, 'var(--um-dark)']] as const).map(([t, label, badge, badgeBg, badgeColor]) => (
              <button key={t} onClick={() => setTab(t as any)} style={{
                flex: 1, padding: '10px 4px 12px', border: 'none', background: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 700, letterSpacing: 0.3,
                color: tab === t ? '#fff' : 'rgba(255,255,255,0.45)',
                borderBottom: tab === t ? `2.5px solid ${GD}` : '2.5px solid transparent',
                transition: 'all .15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
                {label}
                {badge > 0 && (
                  <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 10, background: badgeBg, color: badgeColor, lineHeight: 1.4 }}>{badge}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* ── Chats tab ── */}
          {tab === 'chats' && (
            <>
              {convLoading && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '52px 0' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', border: `3px solid rgba(154,33,67,0.12)`, borderTopColor: CR, animation: 'ibSpin .8s linear infinite' }} />
                </div>
              )}
              {!convLoading && convs.length === 0 && (
                <div style={{ textAlign: 'center', padding: '60px 20px', background: '#fff', borderRadius: 18, border: `1.5px solid ${BOR}` }}>
                  <div style={{ fontSize: 36, marginBottom: 10, opacity: 0.22 }}>💬</div>
                  <p style={{ margin: '0 0 5px', fontSize: 15, fontWeight: 800, color: DK, fontFamily: 'Georgia,serif' }}>No conversations yet</p>
                  <p style={{ margin: 0, fontSize: 12.5, color: MUT }}>When couples message you, they&apos;ll appear here</p>
                </div>
              )}
              {!convLoading && convs.length > 0 && (
                <div style={{ background: '#fff', borderRadius: 18, overflow: 'hidden', border: `1.5px solid ${BOR}`, boxShadow: '0 2px 12px rgba(26,13,18,0.06)' }}>
                  {convs.map((conv, i) => (
                    <Link key={conv.id} href={`/messages/thread/${conv.id}`} className="ib-conv"
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', textDecoration: 'none', borderBottom: i < convs.length - 1 ? `1px solid ${BOR}` : 'none', background: '#fff', transition: 'background .12s' }}>
                      {conv.couple_avatar ? (
                        <Image src={conv.couple_avatar} alt="" width={46} height={46} style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: `2px solid ${BOR}` }} />
                      ) : (
                        <div style={{ width: 46, height: 46, borderRadius: '50%', background: `linear-gradient(135deg,${CR},${CR2})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 17, flexShrink: 0 }}>
                          {(conv.couple_name || 'C')[0].toUpperCase()}
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: 14, fontWeight: conv.unread > 0 ? 800 : 600, color: DK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{conv.couple_name}</p>
                            {conv.has_pending_quote && (
                              <span style={{ flexShrink: 0, fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 8, background: 'rgba(37,99,235,0.1)', color: '#2563eb', border: '1px solid rgba(37,99,235,0.2)', whiteSpace: 'nowrap' }}>Quote</span>
                            )}
                          </div>
                          <span style={{ fontSize: 10.5, color: MUT, flexShrink: 0, marginLeft: 8, fontWeight: 500 }}>{conv.last_message_at ? timeAgo(conv.last_message_at) : ''}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <p style={{ margin: 0, fontSize: 12.5, color: conv.unread > 0 ? DK : MUT, fontWeight: conv.unread > 0 ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {conv.last_message || 'Start the conversation'}
                          </p>
                          {conv.unread > 0 && (
                            <span style={{ flexShrink: 0, minWidth: 19, height: 19, borderRadius: 10, background: CR, color: '#fff', fontSize: 9.5, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>{conv.unread}</span>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── Quotes tab ── */}
          {tab === 'quotes' && (
            <>
              {quotesLoading && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '52px 0' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', border: `3px solid rgba(154,33,67,0.12)`, borderTopColor: CR, animation: 'ibSpin .8s linear infinite' }} />
                </div>
              )}
              {!quotesLoading && quotes.length === 0 && (
                <div style={{ textAlign: 'center', padding: '60px 20px', background: '#fff', borderRadius: 18, border: `1.5px solid ${BOR}` }}>
                  <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(37,99,235,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                    <svg width="24" height="24" fill="none" stroke="#2563eb" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  </div>
                  <p style={{ margin: '0 0 5px', fontSize: 15, fontWeight: 800, color: DK, fontFamily: 'Georgia,serif' }}>No quote requests yet</p>
                  <p style={{ margin: 0, fontSize: 12.5, color: MUT }}>When couples request quotes, they&apos;ll appear here</p>
                </div>
              )}
              {!quotesLoading && quotes.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {quotes.map((q, i) => {
                    const statusColor = q.status === 'requested' ? '#2563eb' : q.status === 'negotiating' ? '#f59e0b' : q.status === 'accepted' || q.status === 'booked' ? '#22c55e' : q.status === 'declined' ? '#ef4444' : MUT;
                    const statusLabel = q.status === 'requested' ? 'Awaiting Reply' : q.status === 'negotiating' ? 'Quote Sent' : q.status === 'accepted' ? 'Accepted' : q.status === 'booked' ? 'Booked' : q.status === 'declined' ? 'Declined' : q.status;
                    const initials = (q.couple_name || 'C')[0].toUpperCase();
                    return (
                      <div key={q.id} style={{ background: '#fff', borderRadius: 16, border: `1.5px solid ${q.status === 'requested' ? 'rgba(37,99,235,0.25)' : BOR}`, overflow: 'hidden', boxShadow: q.status === 'requested' ? '0 2px 12px rgba(37,99,235,0.08)' : '0 2px 8px rgba(26,13,18,0.04)', animation: `ibFade .3s ease ${i * 0.04}s both` }}>
                        <div style={{ height: 3, background: statusColor }} />
                        <div style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
                            {q.couple_avatar ? (
                              <Image src={q.couple_avatar} alt="" width={40} height={40} style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                            ) : (
                              <div style={{ width: 40, height: 40, borderRadius: '50%', background: `linear-gradient(135deg,${CR},${CR2})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 16, flexShrink: 0 }}>{initials}</div>
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: DK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.couple_name}</p>
                                <span style={{ fontSize: 10.5, color: MUT, flexShrink: 0, fontWeight: 500 }}>{timeAgo(q.created_at)}</span>
                              </div>
                              <p style={{ margin: '2px 0 0', fontSize: 12.5, color: MUT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {q.package_name || `Quote #${q.quote_ref}`}
                              </p>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 8, background: `${statusColor}18`, color: statusColor, border: `1px solid ${statusColor}30` }}>{statusLabel}</span>
                              {q.vendor_final_price && (
                                <span style={{ fontSize: 12, fontWeight: 700, color: CR }}>R{q.vendor_final_price.toLocaleString()}</span>
                              )}
                              {!q.vendor_final_price && q.base_from_price && (
                                <span style={{ fontSize: 11, color: MUT }}>Est. R{q.base_from_price.toLocaleString()}</span>
                              )}
                            </div>
                            {q.conversation_id ? (
                              <Link href={`/messages/thread/${q.conversation_id}`} style={{ padding: '8px 16px', borderRadius: 10, background: q.status === 'requested' ? `linear-gradient(135deg,${CR},${CR2})` : 'rgba(0,0,0,0.05)', color: q.status === 'requested' ? '#fff' : MUT, fontSize: 12, fontWeight: 700, textDecoration: 'none', flexShrink: 0 }}>
                                {q.status === 'requested' ? 'Reply' : 'View'}
                              </Link>
                            ) : (
                              <span style={{ fontSize: 11, color: MUT, fontStyle: 'italic' }}>No thread</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* ── Alerts tab ── */}
          {tab === 'alerts' && (
            <>
              {unreadAlerts > 0 && (
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={handleMarkAllRead} disabled={markingAll} style={{ padding: '7px 16px', borderRadius: 20, border: `1.5px solid ${BOR}`, background: '#fff', color: MUT, fontSize: 12, fontWeight: 700, cursor: markingAll ? 'default' : 'pointer', opacity: markingAll ? 0.6 : 1 }}>
                    {markingAll ? 'Marking…' : 'Mark all read'}
                  </button>
                </div>
              )}
              {notifsLoading && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '52px 0' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', border: `3px solid rgba(154,33,67,0.12)`, borderTopColor: CR, animation: 'ibSpin .8s linear infinite' }} />
                </div>
              )}
              {!notifsLoading && notifs.length === 0 && (
                <div style={{ textAlign: 'center', padding: '60px 20px', background: '#fff', borderRadius: 18, border: `1.5px solid ${BOR}` }}>
                  <div style={{ fontSize: 36, marginBottom: 10, opacity: 0.22 }}>🔔</div>
                  <p style={{ margin: '0 0 5px', fontSize: 15, fontWeight: 800, color: DK, fontFamily: 'Georgia,serif' }}>No alerts yet</p>
                  <p style={{ margin: 0, fontSize: 12.5, color: MUT }}>Updates about quotes, bookings and more will show here</p>
                </div>
              )}
              {!notifsLoading && notifs.map((item, i) => (
                <button key={item.id} onClick={() => handleOpenNotif(item)} className="ib-notif" style={{
                  width: '100%', textAlign: 'left', borderRadius: 16, padding: '14px 16px',
                  cursor: 'pointer', transition: 'opacity .12s',
                  border: `1.5px solid ${item.is_read ? BOR : 'rgba(154,33,67,0.22)'}`,
                  background: item.is_read ? '#fff' : 'rgba(154,33,67,0.04)',
                  animation: `ibFade .3s ease ${i * 0.04}s both`,
                  boxShadow: item.is_read ? 'none' : '0 2px 8px rgba(154,33,67,0.06)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ width: 42, height: 42, borderRadius: 13, background: item.is_read ? 'rgba(0,0,0,0.04)' : 'rgba(154,33,67,0.08)', border: `1px solid ${item.is_read ? BOR : 'rgba(154,33,67,0.15)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                      {notifIcon(item.type)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 3 }}>
                        <p style={{ margin: 0, fontSize: 13.5, fontWeight: item.is_read ? 600 : 800, color: DK, lineHeight: 1.3 }}>{item.title}</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          {!item.is_read && <div style={{ width: 7, height: 7, borderRadius: '50%', background: CR }} />}
                          <span style={{ fontSize: 10.5, color: MUT, fontWeight: 500 }}>{timeAgo(item.created_at)}</span>
                        </div>
                      </div>
                      <p style={{ margin: 0, fontSize: 12, color: MUT, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.5 } as React.CSSProperties}>{item.body}</p>
                    </div>
                  </div>
                </button>
              ))}
            </>
          )}

        </div>
      </div>

      <VendorBottomNav />
    </div>
  );
}
