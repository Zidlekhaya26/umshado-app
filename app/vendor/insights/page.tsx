'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import VendorBottomNav from '@/components/VendorBottomNav';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Legend, Area, AreaChart,
} from 'recharts';

/* ─── Types ─────────────────────────────────────────────── */
interface DailyStatsRow {
  day: string; profile_views: number;
  saves: number; quotes: number; messages: number;
  package_views: number; contact_clicks: number;
}
interface VendorInfo { id: string; business_name: string | null; plan?: string | null; }
interface VendorEvent {
  event_type: 'profile_view' | 'save_vendor' | 'quote_requested' | 'message_started' | 'package_view' | 'contact_click';
  meta: any; created_at: string;
}

/* ─── Design tokens ──────────────────────────────────────── */
const GOLD    = '#b8973e';
const GOLD_LT = 'rgba(184,151,62,0.15)';
const DARK    = '#18100a';
const MID     = '#5c3d28';
const BG      = '#faf7f2';

/* ─── Metric config ──────────────────────────────────────── */
const METRICS = [
  { key: 'profile_views',  label: 'Profile Views',  color: '#b8973e', icon: '👁️', desc: 'Couples who viewed your profile' },
  { key: 'quotes',         label: 'Quote Requests', color: '#2d7a4f', icon: '📋', desc: 'Quotes requested from you' },
  { key: 'messages',       label: 'Messages',       color: '#1a6aa8', icon: '💬', desc: 'Conversations started' },
  { key: 'saves',          label: 'Saves',          color: '#8b3a8b', icon: '❤️', desc: 'Times saved by couples' },
  { key: 'package_views',  label: 'Package Views',  color: '#c47a20', icon: '📦', desc: 'Couples who browsed your packages' },
  { key: 'contact_clicks', label: 'Contact Clicks', color: '#2a7a8b', icon: '📞', desc: 'Times your contact was clicked' },
];

/* ─── Custom tooltip ─────────────────────────────────────── */
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1.5px solid rgba(184,151,62,0.2)', borderRadius: 12, padding: '10px 14px', boxShadow: '0 4px 16px rgba(0,0,0,0.1)', fontFamily: 'Georgia,serif' }}>
      <p style={{ margin: '0 0 6px', fontSize: 11, color: '#9a7c58', fontWeight: 600 }}>{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: DARK, fontWeight: 600 }}>{p.value}</span>
          <span style={{ fontSize: 11, color: '#9a7c58' }}>{p.name}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── Stat card ──────────────────────────────────────────── */
function StatCard({ icon, label, value, desc, color, change }: {
  icon: string; label: string; value: number;
  desc: string; color: string; change?: number;
}) {
  const isPositive = (change ?? 0) >= 0;
  return (
    <div style={{ background: '#fff', borderRadius: 18, padding: '18px 16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1.5px solid rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{icon}</div>
        {change !== undefined && (
          <div style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: isPositive ? 'rgba(45,122,79,0.1)' : 'rgba(200,50,50,0.1)', color: isPositive ? '#2d7a4f' : '#c83232' }}>
            {isPositive ? '↑' : '↓'} {Math.abs(change)}%
          </div>
        )}
      </div>
      <div>
        <div style={{ fontSize: 28, fontWeight: 700, color: DARK, fontFamily: 'Georgia,serif', lineHeight: 1 }}>{value.toLocaleString()}</div>
        <div style={{ fontSize: 11, color: color, fontWeight: 700, marginTop: 3 }}>{label}</div>
        <div style={{ fontSize: 10, color: '#9a7c58', marginTop: 2 }}>{desc}</div>
      </div>
    </div>
  );
}

/* ─── Plan badge ─────────────────────────────────────────── */
function PlanBadge({ plan }: { plan?: string | null }) {
  const styles: Record<string, { bg: string; color: string; label: string }> = {
    elite:   { bg: 'linear-gradient(135deg,#b8973e,#8a6010)', color: '#fff', label: '✦ Elite' },
    pro:     { bg: 'linear-gradient(135deg,#4a1d96,#6d28d9)', color: '#fff', label: '⚡ Pro' },
    starter: { bg: 'rgba(184,151,62,0.15)', color: '#8a6010', label: 'Starter' },
    free:    { bg: '#f1f1f1', color: '#888', label: 'Free' },
  };
  const s = styles[plan ?? 'free'] ?? styles.free;
  return (
    <div style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20, background: s.bg, color: s.color, letterSpacing: 0.3 }}>{s.label}</div>
  );
}

/* ─── Main ───────────────────────────────────────────────── */
export default function VendorInsights() {
  const [vendor, setVendor] = useState<VendorInfo | null>(null);
  const [dailyStats, setDailyStats] = useState<DailyStatsRow[]>([]);
  const [topPackage, setTopPackage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeMetric, setActiveMetric] = useState<string>('profile_views');

  const last7Days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().slice(0, 10);
    });
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true); setError(null);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setError('Please sign in to view insights.'); return; }

        const { data: v1 } = await supabase.from('vendors').select('id,business_name,plan').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
        const { data: v2 } = await supabase.from('vendors').select('id,business_name,plan').eq('id', user.id).maybeSingle();
        const vendorRow = v1 || v2;
        if (!vendorRow) { setError('Vendor profile not found.'); return; }
        setVendor(vendorRow);

        const sinceDate = last7Days[0];
        const statsMap: Record<string, DailyStatsRow> = {};
        const emptyRow = (day: string): DailyStatsRow => ({ day, profile_views: 0, saves: 0, quotes: 0, messages: 0, package_views: 0, contact_clicks: 0 });

        const { data: statsRows } = await supabase
          .from('vendor_stats_daily')
          .select('day,profile_views,saves,quotes,messages,package_views,contact_clicks')
          .eq('vendor_id', vendorRow.id)
          .gte('day', sinceDate);

        (statsRows || []).forEach((row: any) => {
          statsMap[row.day] = {
            day: row.day,
            profile_views:  row.profile_views  || 0,
            saves:          row.saves          || 0,
            quotes:         row.quotes         || 0,
            messages:       row.messages       || 0,
            package_views:  row.package_views  || 0,
            contact_clicks: row.contact_clicks || 0,
          };
        });

        // Always fetch vendor_events to fill gaps and compute top package
        const { data: events } = await supabase
          .from('vendor_events')
          .select('event_type,meta,created_at')
          .eq('vendor_id', vendorRow.id)
          .gte('created_at', new Date(sinceDate).toISOString());

        const pkgCounts: Record<string, number> = {};
        if (!statsRows || statsRows.length === 0) {
          // No daily stats yet — build entirely from raw events
          (events || []).forEach((ev: VendorEvent) => {
            const dk = ev.created_at.slice(0, 10);
            if (!statsMap[dk]) statsMap[dk] = emptyRow(dk);
            if (ev.event_type === 'profile_view')   statsMap[dk].profile_views++;
            if (ev.event_type === 'save_vendor')     statsMap[dk].saves++;
            if (ev.event_type === 'quote_requested') statsMap[dk].quotes++;
            if (ev.event_type === 'message_started') statsMap[dk].messages++;
            if (ev.event_type === 'package_view')    statsMap[dk].package_views++;
            if (ev.event_type === 'contact_click')   statsMap[dk].contact_clicks++;
          });
        }
        // Always compute top package from raw events
        (events || []).forEach((ev: VendorEvent) => {
          if (ev.event_type === 'package_view') {
            const k = ev.meta?.package_name || ev.meta?.package_id || 'Unknown';
            pkgCounts[k] = (pkgCounts[k] || 0) + 1;
          }
        });
        const top = Object.entries(pkgCounts).sort((a, b) => b[1] - a[1])[0];
        setTopPackage(top ? top[0] : '');

        setDailyStats(last7Days.map(day => statsMap[day] || emptyRow(day)));
      } catch (e: any) { setError(e.message || 'Failed to load insights.'); }
      finally { setLoading(false); }
    })();
  }, [last7Days]);

  const totals = dailyStats.reduce((acc, r) => ({
    profile_views:  acc.profile_views  + r.profile_views,
    saves:          acc.saves          + r.saves,
    quotes:         acc.quotes         + r.quotes,
    messages:       acc.messages       + r.messages,
    package_views:  acc.package_views  + r.package_views,
    contact_clicks: acc.contact_clicks + r.contact_clicks,
  }), { profile_views: 0, saves: 0, quotes: 0, messages: 0, package_views: 0, contact_clicks: 0 });

  // Format day labels for chart
  const chartData = dailyStats.map(r => ({
    ...r,
    dayLabel: new Date(r.day + 'T12:00:00').toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric' }),
  }));

  // Best day
  const rowTotal = (r: DailyStatsRow) => r.profile_views + r.quotes + r.messages + r.saves + r.package_views + r.contact_clicks;
  const bestDay = [...dailyStats].sort((a, b) => rowTotal(b) - rowTotal(a))[0];

  if (loading) {
    return (
      <div style={{ minHeight: '100svh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid rgba(184,151,62,0.2)', borderTopColor: GOLD, animation: 'spin 0.8s linear infinite' }} />
        <p style={{ color: '#9a7c58', fontSize: 13, fontFamily: 'Georgia,serif' }}>Loading insights…</p>
        <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100svh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ background: '#fff', borderRadius: 20, padding: 32, textAlign: 'center', maxWidth: 340 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
          <h2 style={{ margin: '0 0 8px', color: DARK, fontFamily: 'Georgia,serif' }}>Insights unavailable</h2>
          <p style={{ color: '#9a7c58', fontSize: 13 }}>{error}</p>
        </div>
      </div>
    );
  }

  const activeMeta = METRICS.find(m => m.key === activeMetric) ?? METRICS[0];

  return (
    <div style={{ minHeight: '100svh', background: BG, fontFamily: 'system-ui,sans-serif' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', paddingBottom: 100 }}>

        {/* ── Header ── */}
        <div style={{ background: 'linear-gradient(135deg,#9A2143 0%,#b8315a 100%)', padding: '24px 20px 28px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(154,33,67,0.12)', pointerEvents: 'none' }} />
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <p style={{ margin: '0 0 4px', fontSize: 11, color: 'rgba(255,255,255,0.45)', letterSpacing: 2, textTransform: 'uppercase' }}>Performance</p>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#fff', fontFamily: 'Georgia,serif' }}>Insights</h1>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{vendor?.business_name} · Last 7 days</p>
            </div>
            <PlanBadge plan={vendor?.plan} />
          </div>

          {/* Mini totals row */}
          <div style={{ display: 'flex', gap: 8, marginTop: 20, overflowX: 'auto', paddingBottom: 4 }}>
            {METRICS.map(m => (
              <button key={m.key} onClick={() => setActiveMetric(m.key)}
                style={{ flexShrink: 0, minWidth: 60, background: activeMetric === m.key ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)', border: activeMetric === m.key ? '1.5px solid rgba(189,152,63,0.6)' : '1.5px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '10px 8px', cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s' }}>
                <div style={{ fontSize: 16, marginBottom: 3 }}>{m.icon}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', fontFamily: 'Georgia,serif', lineHeight: 1 }}>{(totals as any)[m.key]}</div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', marginTop: 2, letterSpacing: 0.5 }}>{m.label.split(' ')[0].toUpperCase()}</div>
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* ── Stat cards 2×2 ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {METRICS.map(m => (
              <StatCard key={m.key} icon={m.icon} label={m.label} value={(totals as any)[m.key]} desc={m.desc} color={m.color} />
            ))}
          </div>

          {/* ── Main chart ── */}
          <div style={{ background: '#fff', borderRadius: 20, padding: '20px 16px 12px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1.5px solid rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: DARK, fontFamily: 'Georgia,serif' }}>{activeMeta.label}</h2>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: '#9a7c58' }}>Daily breakdown · last 7 days</p>
              </div>
              {/* Metric switcher pills */}
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {METRICS.map(m => (
                  <button key={m.key} onClick={() => setActiveMetric(m.key)}
                    style={{ padding: '4px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700, cursor: 'pointer', border: 'none', background: activeMetric === m.key ? m.color : '#f5f0e8', color: activeMetric === m.key ? '#fff' : '#9a7c58', transition: 'all 0.15s' }}>
                    {m.icon} {m.label.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>

            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={activeMeta.color} stopOpacity={0.18} />
                    <stop offset="95%" stopColor={activeMeta.color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
                <XAxis dataKey="dayLabel" tick={{ fontSize: 10, fill: '#9a7c58' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#9a7c58' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey={activeMetric} name={activeMeta.label} stroke={activeMeta.color} strokeWidth={2.5} fill="url(#areaGrad)" dot={{ r: 4, fill: activeMeta.color, strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* ── Comparison bar chart — all 4 metrics ── */}
          <div style={{ background: '#fff', borderRadius: 20, padding: '20px 16px 12px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1.5px solid rgba(0,0,0,0.05)' }}>
            <h2 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: DARK, fontFamily: 'Georgia,serif' }}>All metrics</h2>
            <p style={{ margin: '0 0 16px', fontSize: 11, color: '#9a7c58' }}>Compare across all activity types</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barSize={12} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
                <XAxis dataKey="dayLabel" tick={{ fontSize: 10, fill: '#9a7c58' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#9a7c58' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} formatter={(v) => METRICS.find(m => m.key === v)?.label ?? v} />
                {METRICS.map(m => <Bar key={m.key} dataKey={m.key} name={m.label} fill={m.color} radius={[4,4,0,0]} />)}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* ── Daily table ── */}
          <div style={{ background: '#fff', borderRadius: 20, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1.5px solid rgba(0,0,0,0.05)' }}>
            <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: DARK, fontFamily: 'Georgia,serif' }}>Day by day</h2>
            </div>
            <div>
              {chartData.map((row, idx) => {
                const total = rowTotal(row);
                const isBest = bestDay?.day === row.day && total > 0;
                return (
                  <div key={row.day} style={{ display: 'flex', alignItems: 'center', padding: '12px 20px', borderBottom: idx < chartData.length-1 ? '1px solid rgba(0,0,0,0.04)' : 'none', background: isBest ? 'rgba(184,151,62,0.04)' : 'transparent' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: DARK }}>{row.dayLabel}</span>
                        {isBest && <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 20, background: 'rgba(184,151,62,0.15)', color: '#8a6010' }}>Best day</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 14 }}>
                      {METRICS.map(m => (
                        <div key={m.key} style={{ textAlign: 'center', minWidth: 32 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: (row as any)[m.key] > 0 ? m.color : '#d0c8bc' }}>{(row as any)[m.key]}</div>
                          <div style={{ fontSize: 8, color: '#b0a898', letterSpacing: 0.5 }}>{m.icon}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Tips panel ── */}
          {totals.profile_views === 0 && (
            <div style={{ background: 'linear-gradient(135deg,#faf7f2,#f5ede0)', borderRadius: 20, padding: '20px', border: '1.5px solid rgba(184,151,62,0.2)' }}>
              <p style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: DARK, fontFamily: 'Georgia,serif' }}>💡 Grow your visibility</p>
              {[
                'Upload a professional logo to stand out in search results',
                'Add at least 3 service packages with clear pricing',
                'Write a detailed business description (100+ words)',
                'Upgrade to Pro for featured placement in the marketplace',
              ].map((tip, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: GOLD_LT, border: '1px solid rgba(184,151,62,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: GOLD, fontWeight: 700, flexShrink: 0 }}>{i+1}</div>
                  <p style={{ margin: 0, fontSize: 12, color: MID, lineHeight: 1.5 }}>{tip}</p>
                </div>
              ))}
            </div>
          )}

          {/* ── Top package ── */}
          {topPackage && topPackage !== 'Based on package views' && (
            <div style={{ background: '#fff', borderRadius: 20, padding: '18px 20px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1.5px solid rgba(184,151,62,0.2)', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(184,151,62,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>⭐</div>
              <div>
                <p style={{ margin: '0 0 2px', fontSize: 10, color: '#9a7c58', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>Top performing package</p>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: DARK, fontFamily: 'Georgia,serif' }}>{topPackage}</p>
              </div>
            </div>
          )}

        </div>
      </div>
      <VendorBottomNav />
    </div>
  );
}
