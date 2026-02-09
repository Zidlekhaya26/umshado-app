'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { LOCKED_CATEGORIES, LOCKED_CATEGORY_SET } from '@/lib/marketplaceCategories';

type CheckResult = {
  id: string;
  label: string;
  status: 'pending' | 'pass' | 'fail' | 'manual';
  details?: string;
};

export default function LaunchChecklist() {
  const [checks, setChecks] = useState<CheckResult[]>([
    { id: 'env', label: 'Env vars loaded', status: 'pending' },
    { id: 'supabase', label: 'Supabase connected', status: 'pending' },
    { id: 'auth', label: 'Auth works', status: 'pending' },
    { id: 'rls', label: 'RLS enforced (self access)', status: 'pending' },
    { id: 'marketplace', label: 'Marketplace loads', status: 'pending' },
    { id: 'messaging', label: 'Messaging works', status: 'pending' },
    { id: 'uploads', label: 'File uploads work', status: 'manual', details: 'Manual check required.' }
  ]);

  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [unknownCategories, setUnknownCategories] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const nextChecks = [...checks];

      // Env
      const hasEnv = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      nextChecks[0] = {
        ...nextChecks[0],
        status: hasEnv ? 'pass' : 'fail',
        details: hasEnv ? undefined : 'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY'
      };

      // Supabase connection + auth
      try {
        const { data: userData, error: authErr } = await supabase.auth.getUser();
        nextChecks[2] = {
          ...nextChecks[2],
          status: authErr ? 'fail' : 'pass',
          details: authErr?.message
        };

        // RLS (self access) - try reading own profile if logged in
        if (userData?.user?.id) {
          const { data: profileData, error: profileErr } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', userData.user.id)
            .maybeSingle();

          nextChecks[3] = {
            ...nextChecks[3],
            status: profileErr ? 'fail' : 'pass',
            details: profileErr?.message || (profileData ? undefined : 'No profile row')
          };
        } else {
          nextChecks[3] = {
            ...nextChecks[3],
            status: 'manual',
            details: 'Sign in to validate RLS.'
          };
        }
      } catch (err: any) {
        nextChecks[2] = { ...nextChecks[2], status: 'fail', details: err?.message };
        nextChecks[3] = { ...nextChecks[3], status: 'fail', details: err?.message };
      }

      // Supabase connectivity check (simple query)
      try {
        const { error } = await supabase.from('profiles').select('id').limit(1);
        nextChecks[1] = { ...nextChecks[1], status: error ? 'fail' : 'pass', details: error?.message };
      } catch (err: any) {
        nextChecks[1] = { ...nextChecks[1], status: 'fail', details: err?.message };
      }

      // Marketplace
      try {
        const { error } = await supabase.from('marketplace_vendors').select('vendor_id').limit(1);
        nextChecks[4] = { ...nextChecks[4], status: error ? 'fail' : 'pass', details: error?.message };
      } catch (err: any) {
        nextChecks[4] = { ...nextChecks[4], status: 'fail', details: err?.message };
      }

      // Messaging (conversations)
      try {
        const { error } = await supabase.from('conversations').select('id').limit(1);
        nextChecks[5] = { ...nextChecks[5], status: error ? 'fail' : 'pass', details: error?.message };
      } catch (err: any) {
        nextChecks[5] = { ...nextChecks[5], status: 'fail', details: err?.message };
      }

      // Marketplace category audit (services by category)
      try {
        const { data: servicesData, error: servicesError } = await supabase
          .from('services')
          .select('category');

        if (!servicesError) {
          const counts: Record<string, number> = {};
          const unknownSet = new Set<string>();

          LOCKED_CATEGORIES.forEach((cat) => {
            counts[cat] = 0;
          });

          (servicesData || []).forEach((row: { category: string | null }) => {
            const category = row?.category?.trim() || 'Uncategorized';
            if (!LOCKED_CATEGORY_SET.has(category)) {
              unknownSet.add(category);
            }
            counts[category] = (counts[category] || 0) + 1;
          });

          setCategoryCounts(counts);
          setUnknownCategories(Array.from(unknownSet).sort((a, b) => a.localeCompare(b)));
        }
      } catch (err: any) {
        console.warn('Category audit failed:', err?.message || err);
      }

      setChecks(nextChecks);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const badge = (status: CheckResult['status']) => {
    if (status === 'pass') return 'bg-green-100 text-green-700';
    if (status === 'fail') return 'bg-red-100 text-red-700';
    if (status === 'manual') return 'bg-amber-100 text-amber-700';
    return 'bg-gray-100 text-gray-600';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto min-h-screen bg-white shadow-lg flex flex-col pb-16">
        <div className="bg-white border-b border-gray-200 px-4 py-5">
          <h1 className="text-xl font-bold text-gray-900">Launch Checklist</h1>
          <p className="text-sm text-gray-600 mt-1">Production readiness quick checks</p>
        </div>

        <div className="flex-1 px-4 py-5 space-y-6">
          {checks.map((check) => (
            <div key={check.id} className="rounded-xl border-2 border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-900">{check.label}</p>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${badge(check.status)}`}>
                  {check.status.toUpperCase()}
                </span>
              </div>
              {check.details && (
                <p className="text-xs text-gray-500 mt-2">{check.details}</p>
              )}
            </div>
          ))}

          <div className="rounded-xl border-2 border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-900">Marketplace Categories</p>
              <span className="text-xs font-semibold px-2 py-1 rounded-full bg-purple-100 text-purple-700">
                DEV
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">Services per locked category</p>
            <div className="mt-3 space-y-1">
              {LOCKED_CATEGORIES.map((category) => (
                <div key={category} className="flex items-center justify-between text-sm text-gray-700">
                  <span>{category}</span>
                  <span className="font-semibold text-gray-900">{categoryCounts[category] ?? 0}</span>
                </div>
              ))}
            </div>

            {unknownCategories.length > 0 && (
              <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                <p className="text-xs font-semibold text-amber-700">Unknown categories detected</p>
                <p className="text-xs text-amber-700 mt-1">{unknownCategories.join(', ')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
