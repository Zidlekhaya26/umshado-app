"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getOrCreateVendorForUser, getVendorSelectedServices, getServicesCatalog, type Service } from "@/lib/vendorServices";
import { getPricingType } from "@/lib/marketplaceCategories";
import ProfileCompletionIndicator from "@/components/ProfileCompletionIndicator";

type PricingMode = "guest-based" | "time-based" | "per-person" | "package-based" | "event-based" | "quantity-based";

interface PackageItem {
  id: string;
  name: string;
  fromPrice: number;
  pricingMode: PricingMode;
  guestRange?: { min: number; max: number };
  hours?: number;
  includedServices: string[];
  isPopular: boolean;
}

export default function VendorPackagesPage() {
  const [availableServices, setAvailableServices] = useState<string[]>([]);
  const [vendorCategory, setVendorCategory] = useState<string>("");
  const [isPublished, setIsPublished] = useState<boolean>(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean>(false);
  const [defaultPricingMode, setDefaultPricingMode] = useState<PricingMode>("guest-based");

  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadVendorAndPackages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dbToAppMode = (mode: string): PricingMode =>
    ({ guest: "guest-based", time: "time-based", "per-person": "per-person", package: "package-based", event: "event-based", quantity: "quantity-based" } as any)[mode] || "guest-based";

  async function loadVendorAndPackages() {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const vId = await getOrCreateVendorForUser();
      if (!vId) return;

      try {
        const { data: vendorRow } = await supabase.from("vendors").select("category,is_published,onboarding_completed").eq("id", vId).maybeSingle();
        if (vendorRow?.category) {
          setVendorCategory(vendorRow.category);
          const catPricing = getPricingType(vendorRow.category);
          setDefaultPricingMode(catPricing as PricingMode);
        }
        if (vendorRow) {
          if (typeof vendorRow.is_published === 'boolean') setIsPublished(Boolean(vendorRow.is_published));
          if (typeof vendorRow.onboarding_completed === 'boolean') setOnboardingCompleted(Boolean(vendorRow.onboarding_completed));
        }
      } catch (err) {
        console.warn("Unable to load vendor category:", err);
      }

      try {
        const [selections, catalog] = await Promise.all([getVendorSelectedServices(vId), getServicesCatalog()]);
        const catalogMap = new Map<string, Service>(catalog.map((s) => [s.id, s]));
        const serviceNames = selections.selectedServiceIds.map((id) => catalogMap.get(id)?.name).filter(Boolean) as string[];
        setAvailableServices(serviceNames.length > 0 ? serviceNames : catalog.map((s) => s.name));
      } catch (err) {
        console.warn("Unable to load vendor services for packages:", err);
      }

      const { data: packagesData, error: packagesError } = await supabase.from("vendor_packages").select("*").eq("vendor_id", vId).order("created_at", { ascending: true });
      if (packagesError) console.error("Error loading packages:", packagesError);

      const transformed: PackageItem[] = (packagesData || []).map((pkg: any) => ({
        id: pkg.id,
        name: pkg.name,
        fromPrice: Number(pkg.base_price),
        pricingMode: dbToAppMode(pkg.pricing_mode),
        guestRange: pkg.pricing_mode === "guest" ? { min: pkg.base_guests || 0, max: pkg.base_guests ? pkg.base_guests + 50 : 50 } : undefined,
        hours: pkg.pricing_mode === "time" ? pkg.base_hours : undefined,
        includedServices: pkg.included_services || [],
        isPopular: !!pkg.is_popular,
      }));

      setPackages(transformed);
    } catch (err) {
      console.error("Error in loadVendorAndPackages:", err);
    } finally {
      setLoading(false);
    }
  }

  const openForm = (_pkg?: PackageItem) => {
    console.log("open form", _pkg?.id);
  };

  const canContinue = packages.length >= 2;
  const [forcedEdit, setForcedEdit] = useState(false);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      setForcedEdit(sp.get('mode') === 'edit');
    }
  }, []);
  const editMode = Boolean(forcedEdit || isPublished || onboardingCompleted);
  const modeQuery = forcedEdit ? '?mode=edit' : '';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto min-h-screen bg-white shadow-lg flex flex-col pb-20">
        <ProfileCompletionIndicator />
        <div className="bg-white border-b border-gray-200 px-4 py-5">
          {!loading && <h1 className="text-xl font-bold text-gray-900">Packages & Pricing</h1>}
          <p className="text-sm text-gray-600 mt-1.5">Create packages for couples to choose from (minimum 2)</p>
        </div>

        <div className="flex-1 px-4 py-5 space-y-4 overflow-y-auto">
          <div className="bg-purple-50 border border-purple-200 rounded-xl px-4 py-3.5">
            <p className="text-sm text-purple-900"><span className="font-semibold">{packages.length} package{packages.length !== 1 ? 's' : ''}</span> created{packages.length < 2 && <span className="block mt-1 text-purple-700">Add at least 2 packages to continue</span>}</p>
          </div>

          {packages.map((pkg) => (
            <div key={pkg.id} className="bg-white rounded-xl border-2 border-gray-200 p-4 space-y-3 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-bold text-gray-900">{pkg.name}</h3>
                    {pkg.isPopular && <span className="px-2.5 py-1 bg-amber-100 text-amber-800 text-xs font-semibold rounded-full">Most popular</span>}
                  </div>
                  <p className="text-xl font-bold text-purple-600 mt-1.5">From R{pkg.fromPrice.toLocaleString()}</p>
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  <button onClick={() => openForm(pkg)} className="p-2.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors" aria-label="Edit package">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span className="font-medium capitalize">{pkg.pricingMode.replace('-', ' ')}</span>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Included services:</p>
                <div className="flex flex-wrap gap-1.5">{pkg.includedServices.map(s => <span key={s} className="px-2.5 py-1 bg-purple-50 text-purple-700 text-xs font-medium rounded-md border border-purple-100">{s}</span>)}</div>
              </div>
            </div>
          ))}

          {!loading && <button onClick={() => openForm()} disabled={loading} className="w-full py-5 border-2 border-dashed border-purple-300 rounded-xl text-purple-600 font-semibold hover:border-purple-400 hover:bg-purple-50 transition-colors flex items-center justify-center gap-2.5 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>Add Package</button>}

          {!loading && packages.length === 0 && <div className="text-center py-8"><p className="text-sm text-gray-500">Start by adding your first package</p></div>}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-4 z-40">
        <div className="max-w-md mx-auto flex gap-3">
          <Link href={`/vendor/services${modeQuery}`} className="flex-1 px-4 py-3.5 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold text-base text-center hover:bg-gray-50 active:bg-gray-100 transition-colors">Back</Link>
          <Link href={editMode ? `/vendor/dashboard` : `/vendor/media${modeQuery}`} className={`flex-1 px-4 py-3.5 rounded-xl font-semibold text-base text-center transition-all ${canContinue ? 'bg-purple-600 text-white hover:bg-purple-700 active:scale-95 shadow-lg shadow-purple-200' : 'bg-gray-300 text-gray-500 cursor-not-allowed pointer-events-none'}`}>{editMode ? 'Save' : 'Continue'}</Link>
        </div>
      </div>
    </div>
  );
}
