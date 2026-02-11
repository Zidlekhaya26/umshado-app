'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface DailyStatsRow {
  day: string;
  profile_views: number;
  saves: number;
  quotes: number;
  messages: number;
}

interface VendorInfo {
  id: string;
  business_name: string | null;
  plan?: string | null;
}

interface VendorEvent {
  event_type: 'profile_view' | 'save_vendor' | 'quote_requested' | 'message_started' | 'package_view';
  meta: any;
  created_at: string;
}

export default function VendorInsights() {
  const [vendor, setVendor] = useState<VendorInfo | null>(null);
  const [dailyStats, setDailyStats] = useState<DailyStatsRow[]>([]);
  const [topPackage, setTopPackage] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const last7Days = useMemo(() => {
    const days: string[] = [];
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }
    return days;
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: userData } = await supabase.auth.getUser();
        const user = userData?.user;
        if (!user) {
          setError('Please sign in to view insights.');
          setLoading(false);
          return;
        }

        const { data: vendorByUser } = await supabase
          .from('vendors')
          .select('id, business_name, plan')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const { data: vendorById } = await supabase
          .from('vendors')
          .select('id, business_name, plan')
          .eq('id', user.id)
          .maybeSingle();

        const vendorRow = vendorByUser || vendorById;
        if (!vendorRow) {
          setError('Vendor profile not found.');
          setLoading(false);
          return;
        }

        setVendor(vendorRow);

        const sinceDate = last7Days[0];

        const { data: statsRows, error: statsError } = await supabase
          .from('vendor_stats_daily')
          .select('day, profile_views, saves, quotes, messages')
          .eq('vendor_id', vendorRow.id)
          .gte('day', sinceDate);

        if (statsError) {
          console.error('Error loading vendor_stats_daily:', statsError);
        }

        const statsMap: Record<string, DailyStatsRow> = {};
        (statsRows || []).forEach((row) => {
          statsMap[row.day] = {
            day: row.day,
            profile_views: row.profile_views || 0,
            saves: row.saves || 0,
            quotes: row.quotes || 0,
            messages: row.messages || 0
          };
        });

        if (!statsRows || statsRows.length === 0) {
          const { data: events, error: eventsError } = await supabase
            .from('vendor_events')
            .select('event_type, meta, created_at')
            .eq('vendor_id', vendorRow.id)
            .gte('created_at', new Date(sinceDate).toISOString());

          if (eventsError) {
            console.error('Error loading vendor_events:', eventsError);
          }

          (events || []).forEach((event: VendorEvent) => {
            const dayKey = event.created_at.slice(0, 10);
            if (!statsMap[dayKey]) {
              statsMap[dayKey] = {
                day: dayKey,
                profile_views: 0,
                saves: 0,
                quotes: 0,
                messages: 0
              };
            }

            if (event.event_type === 'profile_view') statsMap[dayKey].profile_views += 1;
            if (event.event_type === 'save_vendor') statsMap[dayKey].saves += 1;
            if (event.event_type === 'quote_requested') statsMap[dayKey].quotes += 1;
            if (event.event_type === 'message_started') statsMap[dayKey].messages += 1;
          });

          const packageCounts: Record<string, number> = {};
          (events || []).forEach((event: VendorEvent) => {
            if (event.event_type !== 'package_view') return;
            const meta = event.meta || {};
            const key = meta.package_name || meta.package_id || 'Unknown package';
            packageCounts[key] = (packageCounts[key] || 0) + 1;
          });

          const top = Object.entries(packageCounts).sort((a, b) => b[1] - a[1])[0];
          setTopPackage(top ? top[0] : 'No package views yet');
        } else {
          setTopPackage('Based on package views');
        }

        const normalized = last7Days.map((day) =>
          statsMap[day] || {
            day,
            profile_views: 0,
            saves: 0,
            quotes: 0,
            messages: 0
          }
        );

        setDailyStats(normalized);
      } catch (err: any) {
        console.error('Error loading vendor insights:', err);
        setError(err.message || 'Failed to load insights.');
      } finally {
        setLoading(false);
      }
    })();
  }, [last7Days]);

  const totals = dailyStats.reduce(
    (acc, row) => {
      acc.profile_views += row.profile_views;
      acc.saves += row.saves;
      acc.quotes += row.quotes;
      acc.messages += row.messages;
      return acc;
    },
    { profile_views: 0, saves: 0, quotes: 0, messages: 0 }
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading insights...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="mx-auto w-full max-w-md lg:max-w-6xl lg:px-6 bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 text-center mb-2">Insights Unavailable</h2>
          <p className="text-gray-600 text-center">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full max-w-screen-xl mx-auto min-h-screen flex flex-col pb-16 px-4">
        <div className="bg-white border-b border-gray-200 px-4 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Vendor Insights</h1>
              <p className="text-sm text-gray-600 mt-1">{vendor?.business_name || 'Your performance last 7 days'}</p>
            </div>
            {vendor?.plan && (
              <span className="text-xs font-semibold px-2 py-1 rounded-full bg-purple-100 text-purple-700 capitalize">
                {vendor.plan}
              </span>
            )}
          </div>
        </div>

        <div className="flex-1 px-4 py-5 space-y-5 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border-2 border-gray-200 p-4">
              <p className="text-xs text-gray-500">Profile views</p>
              <p className="text-2xl font-bold text-gray-900">{totals.profile_views}</p>
            </div>
            <div className="rounded-xl border-2 border-gray-200 p-4">
              <p className="text-xs text-gray-500">Saves</p>
              <p className="text-2xl font-bold text-gray-900">{totals.saves}</p>
            </div>
            <div className="rounded-xl border-2 border-gray-200 p-4">
              <p className="text-xs text-gray-500">Quote requests</p>
              <p className="text-2xl font-bold text-gray-900">{totals.quotes}</p>
            </div>
            <div className="rounded-xl border-2 border-gray-200 p-4">
              <p className="text-xs text-gray-500">Messages started</p>
              <p className="text-2xl font-bold text-gray-900">{totals.messages}</p>
            </div>
          </div>

          <div className="rounded-xl border-2 border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Last 7 days</h2>
            <div className="space-y-2 text-xs text-gray-600">
              {dailyStats.map((row) => (
                <div key={row.day} className="flex items-center justify-between">
                  <span>{new Date(row.day).toLocaleDateString('en-ZA', { weekday: 'short', day: '2-digit', month: 'short' })}</span>
                  <span>
                    {row.profile_views} views • {row.saves} saves • {row.quotes} quotes • {row.messages} msgs
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border-2 border-purple-200 bg-purple-50 p-4">
            <p className="text-xs text-purple-700">Top performing package</p>
            <p className="text-base font-semibold text-purple-900 mt-1">
              {topPackage || 'No package views yet'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
