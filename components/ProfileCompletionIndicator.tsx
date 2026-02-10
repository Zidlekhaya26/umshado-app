import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

export default function ProfileCompletionIndicator({ className = '' }: { className?: string }) {
  const [loading, setLoading] = useState(true);
  const [vendor, setVendor] = useState<any>(null);
  const [servicesCount, setServicesCount] = useState(0);
  const [packagesCount, setPackagesCount] = useState(0);
  const [portfolioUrls, setPortfolioUrls] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }
        const cols = 'id, business_name, category, location, description, contact, portfolio_urls';
        let v: any = null;
        const { data: v1 } = await supabase.from('vendors').select(cols).eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (v1) { v = v1; } else {
          const { data: v2 } = await supabase.from('vendors').select(cols).eq('id', user.id).maybeSingle();
          if (v2) v = v2;
        }
        setVendor(v);
        setPortfolioUrls(v?.portfolio_urls || []);
        if (v?.id) {
          const [servicesRes, packagesRes] = await Promise.all([
            supabase.from('vendor_services').select('id', { count: 'exact', head: true }).eq('vendor_id', v.id),
            supabase.from('vendor_packages').select('id', { count: 'exact', head: true }).eq('vendor_id', v.id),
          ]);
          setServicesCount(servicesRes.count ?? 0);
          setPackagesCount(packagesRes.count ?? 0);
        }
      } catch (err) {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const profileChecks = vendor ? {
    businessInfo: !!vendor.business_name && !!vendor.category && !!vendor.location && !!vendor.description,
    services: servicesCount > 0,
    packages: packagesCount > 0,
    portfolio: Array.isArray(portfolioUrls) && portfolioUrls.length > 0,
    contact: !!(vendor.contact?.whatsapp || vendor.contact?.phone),
  } : null;
  const completedSteps = profileChecks ? Object.values(profileChecks).filter(Boolean).length : 0;
  const totalSteps = profileChecks ? Object.keys(profileChecks).length : 5;
  const percentComplete = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
  const profileComplete = completedSteps === totalSteps;

  if (loading || !profileChecks) return null;

  return (
    <div className={`rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 text-amber-800 shadow-sm mb-4 ${className}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="font-semibold text-sm">Profile Completion</span>
        <span className="text-xs text-amber-700">{percentComplete}%</span>
      </div>
      <div className="w-full bg-amber-100 rounded-full h-2 mb-2">
        <div className="bg-amber-500 rounded-full h-2 transition-all" style={{ width: `${percentComplete}%` }} />
      </div>
      <ul className="space-y-1 text-xs text-amber-700">
        {!profileChecks.businessInfo && (
          <li><Link href="/vendor/onboarding" className="underline hover:text-white">Business info</Link> <span className="ml-1 text-amber-200">(name, category, location, description)</span></li>
        )}
        {!profileChecks.services && (
          <li><Link href="/vendor/services" className="underline hover:text-white">Select at least 1 service</Link></li>
        )}
        {!profileChecks.packages && (
          <li><Link href="/vendor/packages" className="underline hover:text-white">Create at least 1 package</Link></li>
        )}
        {!profileChecks.portfolio && (
          <li><Link href="/vendor/media" className="underline hover:text-white">Upload at least 1 portfolio image</Link></li>
        )}
        {!profileChecks.contact && (
          <li><Link href="/vendor/media" className="underline hover:text-white">Add contact details</Link> <span className="ml-1 text-amber-200">(phone or WhatsApp)</span></li>
        )}
      </ul>
    </div>
  );
}
