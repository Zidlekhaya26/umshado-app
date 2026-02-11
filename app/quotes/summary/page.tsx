'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import { trackVendorEvent } from '@/lib/analytics';
import { getVendorSelectedServices, getServicesCatalog, type Service as CatalogService } from '@/lib/vendorServices';

interface VendorPackage {
  id: string;
  name: string;
  description: string;
  pricing_mode: 'guest' | 'time';
  base_price: number;
  base_guests: number;
  base_hours: number;
  price_per_guest: number;
  price_per_hour: number;
  included_services: string[];
}

interface Vendor {
  id: string;
  business_name: string;
  category: string;
  city: string;
  country: string;
}

interface AddOn {
  id: string;
  name: string;
  // price is intentionally optional — we don't display mock prices here
  price?: number | null;
}

function QuoteSummaryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const vendorId = searchParams.get('vendorId');
  const packageId = searchParams.get('packageId');

  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [pkg, setPkg] = useState<VendorPackage | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [guestCount, setGuestCount] = useState<number>(50);
  const [hours, setHours] = useState<number>(4);
  const [notes, setNotes] = useState('');
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);

  // Available add-ons will be populated from the vendor's declared services
  const [availableAddOns, setAvailableAddOns] = useState<AddOn[]>([]);

  useEffect(() => {
    loadData();
  }, [vendorId, packageId]);

  const loadData = async () => {
    if (!vendorId || !packageId) {
      setError('Missing vendor or package ID');
      setLoading(false);
      return;
    }

    try {
      // Fetch vendor (try direct vendors row first, then fall back to the marketplace view)
      let vendorData: any = null;
      const { data: vd, error: vErr } = await supabase
        .from('vendors')
        .select('id, business_name, category, city, country')
        .eq('id', vendorId)
        .maybeSingle();

      if (vd) {
        vendorData = vd;
      } else {
        // Some deployments / RLS configurations restrict direct access to `vendors`.
        // The `marketplace_vendors` view exposes public vendor info — try that next.
        const { data: mv } = await supabase
          .from('marketplace_vendors')
          .select('vendor_id, business_name, category, city, country')
          .eq('vendor_id', vendorId)
          .maybeSingle();

        if (mv) {
          vendorData = { id: mv.vendor_id, business_name: mv.business_name, category: mv.category, city: mv.city, country: mv.country };
        }
      }

      if (!vendorData) {
        console.error('Error fetching vendor:', vErr);
        setError('Vendor not found');
        setLoading(false);
        return;
      }

      // Fetch package
      const { data: pkgData, error: pkgError } = await supabase
        .from('vendor_packages')
        .select('*')
        .eq('id', packageId)
        .single();

      if (pkgError) {
        console.error('Error fetching package:', pkgError);
        setError('Package not found');
        setLoading(false);
        return;
      }

      setVendor(vendorData);
      setPkg(pkgData);

      // Set defaults based on package
      if (pkgData.base_guests) setGuestCount(pkgData.base_guests);
      if (pkgData.base_hours) setHours(pkgData.base_hours);

      // Load vendor services and map to add-ons (exclude services already included in the package)
      try {
        const selections = await getVendorSelectedServices(vendorId);
        const catalog = await getServicesCatalog();

        const included = (pkgData.included_services || []).map((s: string) => s.toLowerCase());

        // Map selected service IDs to catalog names
        const catalogById = new Map<string, CatalogService>();
        catalog.forEach(c => catalogById.set(c.id, c));

        const fromCatalog: AddOn[] = selections.selectedServiceIds
          .filter(Boolean)
          .map((sid) => {
            const svc = catalogById.get(sid);
            return svc ? { id: `svc:${sid}`, name: svc.name } : null;
          })
          .filter(Boolean) as AddOn[];

        // Custom services (free-text names) — prefix id to avoid collisions
        const custom: AddOn[] = (selections.customServices || []).map((name, idx) => ({ id: `custom:${idx}`, name }));

        // Combine and remove any that are already part of the package included services
        const all = [...fromCatalog, ...custom].filter(a => !included.includes(a.name.toLowerCase()));

        setAvailableAddOns(all);
      } catch (svcErr) {
        console.warn('Could not load vendor services for add-ons', svcErr);
        setAvailableAddOns([]);
      }

    } catch (err: any) {
      console.error('Error loading data:', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const toggleAddOn = (addOnId: string) => {
    if (selectedAddOns.includes(addOnId)) {
      setSelectedAddOns(selectedAddOns.filter(id => id !== addOnId));
    } else {
      setSelectedAddOns([...selectedAddOns, addOnId]);
    }
  };

  const calculateTotal = (): number => {
    if (!pkg) return 0;

    let total = pkg.base_price;

    // Calculate based on pricing mode
    if (pkg.pricing_mode === 'guest' && pkg.price_per_guest) {
      const extraGuests = Math.max(0, guestCount - (pkg.base_guests || 0));
      total += extraGuests * pkg.price_per_guest;
    }

    if (pkg.pricing_mode === 'time' && pkg.price_per_hour) {
      const extraHours = Math.max(0, hours - (pkg.base_hours || 0));
      total += extraHours * pkg.price_per_hour;
    }

    // Note: add-on prices are not included here — vendor will confirm pricing in chat

    return total;
  };

  const handleRequestQuote = async () => {
    if (!vendor || !pkg) return;

    try {
      setSubmitting(true);
      setError(null);

      // Get current user + access token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.user) {
        setError('Please sign in to request a quote');
        setSubmitting(false);
        return;
      }

      const user = session.user;

      // Generate quote ref using Supabase function
      const { data: refData, error: refError } = await supabase
        .rpc('generate_quote_ref');

      if (refError) {
        console.error('Error generating quote ref:', refError);
        setError('Failed to generate quote reference');
        setSubmitting(false);
        return;
      }

      const quoteRef = refData as string;

      // Prepare add-ons data
      const addOnsData = selectedAddOns.map(addOnId => {
        const addOn = availableAddOns.find(a => a.id === addOnId);
        return addOn ? { id: addOn.id, name: addOn.name } : null;
      }).filter(Boolean);

      // Call server API route (handles quote + conversation + message + notifications)
      const res = await fetch('/api/quotes/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          vendorId,
          packageId,
          packageName: pkg.name,
          pricingMode: pkg.pricing_mode === 'guest' ? 'guest-based' : 'time-based',
          guestCount: pkg.pricing_mode === 'guest' ? guestCount : null,
          hours: pkg.pricing_mode === 'time' ? hours : null,
          basePrice: calculateTotal(),
          addOns: addOnsData,
          notes: notes || null,
          quoteRef,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        setError(result.error || 'Failed to create quote');
        setSubmitting(false);
        return;
      }

      if (vendor?.id) {
        await trackVendorEvent(vendor.id, 'quote_requested', {
          source: 'quotes_summary',
          quote_id: result.quoteId,
          package_id: packageId
        });
      }

      // Redirect to chat
      router.push(`/messages/thread/${result.conversationId}`);

    } catch (err: any) {
      console.error('Error requesting quote:', err);
      setError(err.message || 'Failed to request quote');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading quote details...</p>
        </div>
      </div>
    );
  }

  if (error && !vendor) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="mx-auto w-full max-w-md lg:max-w-6xl lg:px-6 bg-white rounded-xl shadow-lg p-6">
          <div className="text-red-600 mb-4">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 text-center mb-2">Error Loading Quote</h2>
          <p className="text-gray-600 text-center mb-4">{error}</p>
          <Link
            href="/marketplace"
            className="block w-full px-4 py-2 bg-purple-600 text-white rounded-lg text-center font-semibold hover:bg-purple-700"
          >
            Back to Marketplace
          </Link>
        </div>
      </div>
    );
  }

    return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full max-w-screen-xl mx-auto min-h-screen flex flex-col pb-20 px-4">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-4 py-5">
          <Link href={`/marketplace/vendor/${vendorId}`} className="inline-flex items-center text-purple-600 text-sm font-medium mb-3">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Vendor
          </Link>
          <h1 className="text-xl font-bold text-gray-900">Request Quote</h1>
          <p className="text-sm text-gray-600 mt-1">{vendor?.business_name}</p>
        </div>

        {/* Content */}
        <div className="flex-1 px-4 py-5 space-y-5 overflow-y-auto">
          {/* Package Info */}
          <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-4">
            <h2 className="text-lg font-bold text-gray-900 mb-1">{pkg?.name}</h2>
            <p className="text-sm text-gray-600 mb-3">{pkg?.description}</p>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Base Price:</span>
              <span className="text-lg font-bold text-purple-600">R{pkg?.base_price.toLocaleString()}</span>
            </div>
          </div>

          {/* Guest Count / Hours */}
          {pkg?.pricing_mode === 'guest' && (
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Number of Guests
              </label>
              <input
                type="number"
                min={pkg.base_guests || 1}
                value={guestCount}
                onChange={(e) => setGuestCount(parseInt(e.target.value) || 0)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Base: {pkg.base_guests} guests. Additional: R{pkg.price_per_guest}/guest
              </p>
            </div>
          )}

          {pkg?.pricing_mode === 'time' && (
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Number of Hours
              </label>
              <input
                type="number"
                min={pkg.base_hours || 1}
                value={hours}
                onChange={(e) => setHours(parseInt(e.target.value) || 0)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Base: {pkg.base_hours} hours. Additional: R{pkg.price_per_hour}/hour
              </p>
            </div>
          )}

          {/* Add-ons */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-3">
              Optional Add-ons
            </label>
            <div className="space-y-2">
              {availableAddOns.map(addOn => (
                <label
                  key={addOn.id}
                  className={`flex items-center justify-between p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                    selectedAddOns.includes(addOn.id)
                      ? 'bg-purple-50 border-purple-500'
                      : 'bg-white border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedAddOns.includes(addOn.id)}
                      onChange={() => toggleAddOn(addOn.id)}
                      className="w-5 h-5 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
                    />
                      <span className="text-sm font-medium text-gray-900">{addOn.name}</span>
                    </div>
                    {/* No mock price shown for add-ons — vendors supply pricing during conversation */}
                    <span className="text-sm text-gray-500">&nbsp;</span>
                </label>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Additional Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any special requests or questions for the vendor..."
              rows={4}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
            />
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Estimated Total */}
          <div className="bg-gray-100 border-2 border-gray-300 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Base Price:</span>
              <span className="text-sm text-gray-900">R{pkg?.base_price.toLocaleString()}</span>
            </div>
            {pkg?.pricing_mode === 'guest' && pkg.price_per_guest && guestCount > (pkg.base_guests || 0) && (
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-600">Extra Guests:</span>
                <span className="text-sm text-gray-900">
                  R{((guestCount - (pkg.base_guests || 0)) * pkg.price_per_guest).toLocaleString()}
                </span>
              </div>
            )}
            {pkg?.pricing_mode === 'time' && pkg.price_per_hour && hours > (pkg.base_hours || 0) && (
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-600">Extra Hours:</span>
                <span className="text-sm text-gray-900">
                  R{((hours - (pkg.base_hours || 0)) * pkg.price_per_hour).toLocaleString()}
                </span>
              </div>
            )}
            {selectedAddOns.map(addOnId => {
              const addOn = availableAddOns.find(a => a.id === addOnId);
              return addOn ? (
                <div key={addOn.id} className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600">{addOn.name}</span>
                  <span className="text-sm text-gray-500">Price to be confirmed</span>
                </div>
              ) : null;
            })}
            <div className="border-t-2 border-gray-300 mt-3 pt-3">
              <div className="flex items-center justify-between">
                <span className="text-base font-bold text-gray-900">Estimated Total:</span>
                <span className="text-2xl font-bold text-purple-600">R{calculateTotal().toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Fixed Bottom Button */}
        <div className="border-t border-gray-200 bg-white px-4 py-4">
          <button
            onClick={handleRequestQuote}
            disabled={submitting}
            className="w-full px-6 py-4 bg-purple-600 text-white rounded-xl font-bold text-lg hover:bg-purple-700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Requesting...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Request Quote
              </>
            )}
          </button>
          <p className="text-xs text-gray-500 text-center mt-2">
            This will open a chat with the vendor
          </p>
        </div>
      </div>
    </div>
  );
}

export default function QuoteSummary() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <QuoteSummaryContent />
    </Suspense>
  );
}
