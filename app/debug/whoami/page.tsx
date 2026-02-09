"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function WhoAmI() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data: userData } = await supabase.auth.getUser();
        const user = (userData as any)?.user || null;

        let profile = null;
        let vendor = null;
        let couple = null;

        if (user?.id) {
          const p = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
          profile = p.data || null;

          const v = await supabase.from('vendors').select('*').eq('id', user.id).maybeSingle();
          vendor = v.data || null;

          const c = await supabase.from('couples').select('*').eq('id', user.id).maybeSingle();
          couple = c.data || null;
        }

        setData({
          user,
          profile,
          vendor,
          couple,
          status: {
            profileRole: profile?.role || null,
            activeRole: profile?.active_role || null,
            hasCoupleFlag: profile?.has_couple ?? null,
            hasVendorFlag: profile?.has_vendor ?? null,
            hasVendor: !!vendor,
            hasCouple: !!couple
          }
        });
      } catch (err) {
        console.error(err);
        setData({ error: 'Failed to fetch whoami' });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="p-6">Loading…</div>;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h2 className="text-xl font-bold mb-4">Who am I</h2>
      <div className="mb-4 rounded border border-gray-200 bg-white p-4 text-sm">
        <div className="flex items-center justify-between">
          <span className="font-medium text-gray-700">Couple row</span>
          <span className={data?.status?.hasCouple ? 'text-green-600' : 'text-gray-400'}>
            {data?.status?.hasCouple ? 'Exists' : 'Missing'}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="font-medium text-gray-700">Vendor row</span>
          <span className={data?.status?.hasVendor ? 'text-green-600' : 'text-gray-400'}>
            {data?.status?.hasVendor ? 'Exists' : 'Missing'}
          </span>
        </div>
      </div>
      <pre className="bg-gray-100 p-4 rounded">{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
