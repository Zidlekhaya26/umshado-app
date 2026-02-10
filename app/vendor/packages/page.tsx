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
  const [servicesCatalog, setServicesCatalog] = useState<Service[]>([]);
  const [vendorCategory, setVendorCategory] = useState<string>("");
  const [isPublished, setIsPublished] = useState<boolean>(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean>(false);
  const [defaultPricingMode, setDefaultPricingMode] = useState<PricingMode>("guest-based");

  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{
    name: string;
    fromPrice: string; // store as string while typing to avoid mobile quirks
    pricingMode: PricingMode;
    guestRange?: { min: number; max: number };
    hours?: number;
    includedServices: string[];
    isPopular: boolean;
  }>({ name: '', fromPrice: '', pricingMode: defaultPricingMode, guestRange: { min: 0, max: 0 }, hours: 0, includedServices: [], isPopular: false });
  const [formErrors, setFormErrors] = useState<{ guestRange?: string; hours?: string }>({});
  const [prevGuestRange, setPrevGuestRange] = useState<{ min: number; max: number } | null>(null);
  const [prevHours, setPrevHours] = useState<number | null>(null);
  const [showDebug, setShowDebug] = useState(false);

  useEffect(() => {
    loadVendorAndPackages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Determine whether to show debug banner: dev builds or explicit url flag
    try {
      const isDev = process.env.NODE_ENV === 'development';
      const urlFlag = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debugPackages') === '1';
      setShowDebug(Boolean(isDev || urlFlag));
    } catch (e) {
      setShowDebug(false);
    }
  }, []);

  const dbToAppMode = (mode: string): PricingMode =>
    ({ guest: "guest-based", time: "time-based", "per-person": "per-person", package: "package-based", event: "event-based", quantity: "quantity-based" } as any)[mode] || "guest-based";

  const appToDbMode = (mode: PricingMode): string =>
    ({ "guest-based": 'guest', "time-based": 'time', 'per-person': 'per-person', 'package-based': 'package', 'event-based': 'event', 'quantity-based': 'quantity' } as any)[mode] || 'guest';

  async function loadVendorAndPackages() {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const vId = await getOrCreateVendorForUser();
      if (!vId) return;
      setVendorId(vId);

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
        setServicesCatalog(catalog || []);
        const catalogMap = new Map<string, Service>((catalog || []).map((s) => [s.id, s]));
        const serviceNames = (selections?.selectedServiceIds || []).map((id) => catalogMap.get(id)?.name).filter(Boolean) as string[];
        setAvailableServices(serviceNames.length > 0 ? serviceNames : (catalog || []).map((s) => s.name));
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
    if (_pkg) {
      setEditingId(_pkg.id);
      setFormData({
        name: _pkg.name,
        fromPrice: String(_pkg.fromPrice ?? ''),
        pricingMode: _pkg.pricingMode,
        guestRange: _pkg.guestRange,
        hours: _pkg.hours,
        includedServices: _pkg.includedServices,
        isPopular: _pkg.isPopular,
      });
    } else {
      setEditingId(null);
      setFormData({ name: '', fromPrice: '', pricingMode: defaultPricingMode, guestRange: { min: 0, max: 0 }, hours: 0, includedServices: [], isPopular: false });
    }
    setIsFormOpen(true);
  };

  const handlePricingModeChange = (mode: PricingMode) => {
    // remember current values for restore when switching back
    if (formData.pricingMode === 'guest-based') setPrevGuestRange(formData.guestRange ?? null);
    if (formData.pricingMode === 'time-based') setPrevHours(formData.hours ?? null);

    const next = { ...formData, pricingMode: mode } as typeof formData;
    if (mode === 'time-based') {
      // restore previous hours if present, otherwise sensible default
      next.hours = prevHours && prevHours > 0 ? prevHours : (next.hours && next.hours > 0 ? next.hours : 4);
      next.guestRange = next.guestRange || { min: 0, max: 0 };
    }
    if (mode === 'guest-based') {
      next.guestRange = prevGuestRange ?? (next.guestRange && next.guestRange.min > 0 ? next.guestRange : { min: 1, max: 50 });
      next.hours = next.hours || 0;
    }
    if (mode === 'package-based') {
      // clear mode-specific fields but remember them in prev states
      next.hours = 0;
      next.guestRange = { min: 0, max: 0 };
    }
    setFormErrors({});
    setFormData(next);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingId(null);
  };

  // Prevent background scrolling while the bottom-sheet modal is open
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const prev = document.body.style.overflow;
    if (isFormOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = prev || '';
    }
    return () => {
      document.body.style.overflow = prev || '';
    };
  }, [isFormOpen]);

  const savePackage = async () => {
    if (!vendorId) {
      alert('Vendor profile not loaded');
      return;
    }

    // Normalize and validate price string -> integer
    const priceInt = parseInt(formData.fromPrice === '' ? '0' : formData.fromPrice, 10) || 0;
    if (!formData.name || priceInt <= 0) {
      alert('Please fill in package name and a valid price (> 0)');
      return;
    }

    // Client-side validation for conditional fields
    if (formData.pricingMode === 'guest-based') {
      const min = formData.guestRange?.min || 0;
      const max = formData.guestRange?.max || 0;
      if (min <= 0) { alert('Please set a valid minimum guests (> 0)'); return; }
      if (min > max) { alert('Minimum guests must be less than or equal to Maximum guests'); return; }
    }
    if (formData.pricingMode === 'time-based') {
      if (!formData.hours || formData.hours <= 0) { alert('Please set hours coverage (> 0)'); return; }
    }

    const payload = {
      vendor_id: vendorId,
      name: formData.name,
      base_price: priceInt,
      pricing_mode: appToDbMode(formData.pricingMode), // convert UI mode -> DB value
      base_guests: formData.pricingMode === 'guest-based' ? (formData.guestRange?.min || null) : null,
      base_hours: formData.pricingMode === 'time-based' ? (formData.hours || null) : null,
      included_services: formData.includedServices,
      is_popular: formData.isPopular,
    };

    try {
      setLoading(true);
      if (editingId) {
        const { data, error } = await supabase.from('vendor_packages').update({ name: payload.name, base_price: payload.base_price, pricing_mode: payload.pricing_mode, base_guests: payload.base_guests, base_hours: payload.base_hours, included_services: payload.included_services, is_popular: payload.is_popular }).eq('id', editingId).select();
        if (error) {
          console.error('savePackage error (update)', { error, payload, vendorId });
          alert(`${error.message}${error.code ? ` (code ${error.code})` : ''}`);
          return;
        }
      } else {
        const { data, error } = await supabase.from('vendor_packages').insert(payload).select();
        if (error) {
          console.error('savePackage error (insert)', { error, payload, vendorId });
          alert(`${error.message}${error.code ? ` (code ${error.code})` : ''}`);
          return;
        }
      }

      await loadVendorAndPackages();
      closeForm();
    } catch (err) {
      console.error('Unexpected savePackage error', { err, payload, vendorId });
      alert('Unexpected error while saving package. See console for details.');
    } finally {
      setLoading(false);
    }
  };

  const deletePackage = async () => {
    if (!editingId) return;
    if (!confirm('Delete this package? This action cannot be undone.')) return;
    try {
      setLoading(true);
      const { error } = await supabase.from('vendor_packages').delete().eq('id', editingId);
      if (error) {
        console.error('deletePackage error', error);
        alert(`${error.message}${error.code ? ` (code ${error.code})` : ''}`);
        return;
      }
      await loadVendorAndPackages();
      closeForm();
    } catch (err) {
      console.error('Unexpected deletePackage error', err);
      alert('Unexpected error while deleting package. See console for details.');
    } finally {
      setLoading(false);
    }
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
          {showDebug && (
            <div className="mb-3 rounded-lg bg-yellow-50 border border-yellow-200 px-3 py-2 text-sm text-yellow-800">
              <span className="font-semibold">DEBUG:</span>
              <span className="ml-2">isFormOpen: {String(isFormOpen)}</span>
              <span className="ml-2">vendorId: {vendorId ?? 'null'}</span>
              <span className="ml-2">packages: {packages.length}</span>
              <span className="ml-2">servicesCatalog: {servicesCatalog.length}</span>
              {(!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) && (
                <div className="mt-2 text-xs text-red-700">Missing Supabase env vars (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)</div>
              )}
            </div>
          )}
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

          {/* Package Form Modal - Bottom Sheet */}
          {isFormOpen && (
            <div className="fixed inset-0 z-[100] flex items-end justify-center">
              {/* Overlay */}
              <div className="absolute inset-0 bg-black bg-opacity-50" onClick={closeForm} />

              {/* Bottom Sheet */}
              <div className="relative w-full max-w-md bg-white rounded-t-3xl shadow-2xl max-h-[90vh] mx-auto overflow-hidden flex flex-col">
                {/* Scrollable area that contains the header + content (so sticky header is scoped to modal) */}
                <div className="overflow-y-auto">
                  {/* Sticky Header (now inside scrollable area) */}
                  <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-4 flex items-center justify-between z-10">
                    <h2 className="text-lg font-bold text-gray-900">{editingId ? 'Edit Package' : 'Add Package'}</h2>
                    <button onClick={closeForm} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors" aria-label="Close">✕</button>
                  </div>

                  {(!vendorId || servicesCatalog.length === 0) ? (
                    <div className="px-5 py-6 text-center">
                      <p className="text-sm text-gray-600">Loading vendor data…</p>
                    </div>
                  ) : (
                    <div className="px-5 py-4 space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Package name</label>
                        <input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl" />
                      </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">From price (R)</label>
                          <input
                            inputMode="numeric"
                            pattern="[0-9]*"
                            placeholder="e.g. 2000"
                            value={formData.fromPrice}
                            onChange={(e) => {
                              const raw = String(e.target.value || "");
                              const digits = raw.replace(/\D+/g, "");
                              let normalized = digits.replace(/^0+(?=\d)/, "");
                              if (normalized === "") normalized = digits === "" ? "" : "0";
                              if (raw === "") normalized = "";
                              setFormData({ ...formData, fromPrice: normalized });
                            }}
                            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Pricing type</label>
                          <div className="inline-flex rounded-xl bg-gray-100 p-1 gap-1">
                            {([{
                              key: 'guest-based', label: 'Guest-based'
                            }, {
                              key: 'time-based', label: 'Time-based'
                            }, {
                              key: 'package-based', label: 'Package-based'
                            }] as {key: string; label: string;}[]).map(opt => {
                              const active = formData.pricingMode === opt.key;
                              return (
                                <button
                                  key={opt.key}
                                  type="button"
                                  onClick={() => handlePricingModeChange(opt.key as PricingMode)}
                                  aria-pressed={active}
                                  className={`px-3 py-2 text-sm font-semibold rounded-lg transition-colors ${active ? 'bg-white border border-gray-200 text-gray-900' : 'text-gray-600'}`}
                                >
                                  {opt.label}
                                </button>
                              );
                            })}
                          </div>
                          <p className="text-xs text-gray-500 mt-2">
                            {formData.pricingMode === 'guest-based' && 'Used for catering, decor, equipment.'}
                            {formData.pricingMode === 'time-based' && 'Used for DJ, photography/video, MC.'}
                            {formData.pricingMode === 'package-based' && 'Fixed price package.'}
                          </p>

                          {/* Conditional fields */}
                          {formData.pricingMode === 'guest-based' && (
                            <div className="mt-3 grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">Min guests</label>
                                <input
                                  type="number"
                                  min={0}
                                  value={formData.guestRange?.min ?? ''}
                                  onChange={(e) => {
                                    const newMin = Number(e.target.value || 0);
                                    const curMax = formData.guestRange?.max ?? 0;
                                    const nextGuest = { ...(formData.guestRange || { min: 0, max: 0 }), min: newMin };
                                    setFormData({ ...formData, guestRange: nextGuest });
                                    if (newMin <= 0) setFormErrors(f => ({ ...f, guestRange: 'Min guests must be greater than 0' }));
                                    else if (curMax && newMin > curMax) setFormErrors(f => ({ ...f, guestRange: 'Min must be less than or equal to Max' }));
                                    else setFormErrors(f => ({ ...f, guestRange: undefined }));
                                  }}
                                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">Max guests</label>
                                <input
                                  type="number"
                                  min={0}
                                  value={formData.guestRange?.max ?? ''}
                                  onChange={(e) => {
                                    const newMax = Number(e.target.value || 0);
                                    const curMin = formData.guestRange?.min ?? 0;
                                    const nextGuest = { ...(formData.guestRange || { min: 0, max: 0 }), max: newMax };
                                    setFormData({ ...formData, guestRange: nextGuest });
                                    if (newMax <= 0) setFormErrors(f => ({ ...f, guestRange: 'Max guests must be greater than 0' }));
                                    else if (curMin && curMin > newMax) setFormErrors(f => ({ ...f, guestRange: 'Max must be greater than or equal to Min' }));
                                    else setFormErrors(f => ({ ...f, guestRange: undefined }));
                                  }}
                                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl"
                                />
                                {formErrors.guestRange && <p className="text-xs text-red-600 mt-1">{formErrors.guestRange}</p>}
                              </div>
                            </div>
                          )}

                          {formData.pricingMode === 'time-based' && (
                            <div className="mt-3">
                              <label className="block text-xs text-gray-600 mb-1">Hours coverage</label>
                              <input
                                type="number"
                                min={0}
                                value={formData.hours ?? ''}
                                onChange={(e) => {
                                  const newHours = Number(e.target.value || 0);
                                  setFormData({ ...formData, hours: newHours });
                                  if (newHours <= 0) setFormErrors(f => ({ ...f, hours: 'Hours must be greater than 0' }));
                                  else setFormErrors(f => ({ ...f, hours: undefined }));
                                }}
                                className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl"
                              />
                            </div>
                          )}
                        </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Included services</label>
                        <div className="flex flex-wrap gap-2">
                          {availableServices.map((s) => {
                            const selected = formData.includedServices.includes(s);
                            return (
                              <button key={s} type="button" onClick={() => setFormData({ ...formData, includedServices: selected ? formData.includedServices.filter(x => x !== s) : [...formData.includedServices, s] })} className={`px-2.5 py-1 rounded-md text-sm ${selected ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-700 border border-purple-100'}`}>
                                {s}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer stays fixed at modal bottom */}
                <div className="border-t border-gray-200 px-4 py-3 flex gap-3">
                  {editingId ? (
                    <button onClick={deletePackage} disabled={loading} className="px-4 py-3 border-2 border-red-200 text-red-700 bg-red-50 rounded-xl font-semibold text-sm">{loading ? 'Deleting...' : 'Delete'}</button>
                  ) : null}
                  <button onClick={closeForm} className="px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold text-sm">Cancel</button>
                  {/* Disable Save when form invalid */}
                  <button onClick={savePackage} disabled={loading || !(
                    (formData.name && formData.name.trim().length > 0) &&
                    (formData.fromPrice && Number(formData.fromPrice) > 0) &&
                    (formData.pricingMode !== 'guest-based' || ((formData.guestRange?.min || 0) > 0 && (formData.guestRange?.min || 0) <= (formData.guestRange?.max || 0))) &&
                    (formData.pricingMode !== 'time-based' || (formData.hours && formData.hours > 0)) &&
                    !Object.values(formErrors).some(Boolean)
                  )} className={`flex-1 px-4 py-3 ${loading ? 'bg-gray-300 text-gray-700' : 'bg-purple-600 text-white'} rounded-xl font-semibold text-sm`}>{loading ? 'Saving...' : (editingId ? 'Save Changes' : 'Add Package')}</button>
                </div>
              </div>
            </div>
          )}

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
