"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import {
  getOrCreateVendorForUser,
  getServicesCatalog,
  getVendorSelectedServices,
  saveVendorServices,
  groupServicesByCategory,
  type Service,
} from '@/lib/vendorServices';
import { LOCKED_CATEGORIES, LOCKED_CATEGORY_SET } from '@/lib/marketplaceCategories';
import ServicePicker from '@/components/ServicePicker';
import ProfileCompletionIndicator from '@/components/ProfileCompletionIndicator';

export default function VendorServices() {
  const [services, setServices] = useState<Service[]>([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [vendorCategory, setVendorCategory] = useState<string>('');
  const [isPublished, setIsPublished] = useState<boolean>(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean>(false);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const vId = await getOrCreateVendorForUser();
      if (!vId) {
        setError('No active session. Please sign in.');
        setLoading(false);
        return;
      }
      setVendorId(vId);

      // Fetch vendor metadata for ordering and edit-mode detection
      try {
        const { data: vendorRow, error: vendorError } = await supabase
          .from('vendors')
          .select('category,is_published,onboarding_completed')
          .eq('id', vId)
          .maybeSingle();

        if (!vendorError && vendorRow) {
          if (vendorRow.category) setVendorCategory(vendorRow.category);
          if (typeof vendorRow.is_published === 'boolean') setIsPublished(Boolean(vendorRow.is_published));
          if (typeof vendorRow.onboarding_completed === 'boolean') setOnboardingCompleted(Boolean(vendorRow.onboarding_completed));
        }
      } catch (vendorErr) {
        console.warn('Unable to load vendor metadata for services page:', vendorErr);
      }

      const [catalog, selections] = await Promise.all([
        getServicesCatalog(),
        getVendorSelectedServices(vId),
      ]);

      setServices(catalog);
      setSelectedServiceIds(selections.selectedServiceIds);
    } catch (err: any) {
      console.error('Error loading data:', err);
      setError(err.message || 'Failed to load services');
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = async () => {
    if (!vendorId) {
      setError('No vendor ID available');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const result = await saveVendorServices(vendorId, selectedServiceIds);

      if (!result.success) {
        setError(result.error || 'Failed to save services');
        return;
      }

      const editMode = Boolean(isPublished || onboardingCompleted);
      window.location.href = editMode ? '/vendor/dashboard' : '/vendor/packages';
    } catch (err: any) {
      console.error('Error saving services:', err);
      setError(err.message || 'Failed to save services');
    } finally {
      setSaving(false);
    }
  };

  /* ── Ordered category keys (vendor's own category first) ────── */
  const groupedServices = groupServicesByCategory(services);
  const orderedCategoryKeys = useMemo(() => {
    const keys = Object.keys(groupedServices);
    const locked = LOCKED_CATEGORIES.filter((cat) => keys.includes(cat));
    const unknown = keys
      .filter((cat) => !LOCKED_CATEGORY_SET.has(cat))
      .sort((a, b) => a.localeCompare(b));

    let ordered = [...locked, ...unknown];
    if (vendorCategory && ordered.includes(vendorCategory)) {
      ordered = [vendorCategory, ...ordered.filter((cat) => cat !== vendorCategory)];
    }
    return ordered;
  }, [groupedServices, vendorCategory]);

  const totalSelected = selectedServiceIds.length;
  const canContinue = totalSelected > 0;
  const searchParams = useSearchParams();
  const forcedEdit = Boolean(searchParams?.get('mode') === 'edit');
  const editMode = Boolean(forcedEdit || isPublished || onboardingCompleted);
  const backHref = editMode ? '/vendor/dashboard' : '/vendor/onboarding';
  const primaryLabel = saving ? 'Saving...' : editMode ? 'Save' : 'Continue';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto min-h-screen bg-white shadow-lg flex flex-col pb-24">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-4 py-5">
          <h1 className="text-xl font-bold text-gray-900">Select your services</h1>
          <p className="text-sm text-gray-600 mt-1.5">
            Tap <span className="font-semibold text-purple-600">+ Add services</span> for each
            category, then remove any you don&apos;t need.
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 px-4 py-5 space-y-8 overflow-y-auto">
          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {/* Service categories */}
          {!loading && orderedCategoryKeys.map((cat) => (
            <div key={cat}>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">{cat}</h3>
              <ServicePicker
                category={cat}
                services={groupedServices[cat] || []}
                selectedIds={selectedServiceIds}
                onChange={setSelectedServiceIds}
              />
            </div>
          ))}

          {/* Save / Continue */}
          <div className="pt-4">
            {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
            <div className="flex gap-3">
              <Link href={backHref} className="flex-1 px-4 py-3.5 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold text-base text-center hover:bg-gray-50">Back</Link>
              <button
                onClick={handleContinue}
                disabled={!canContinue || saving}
                className={`flex-1 px-4 py-3.5 rounded-xl font-semibold text-base text-center ${canContinue ? 'bg-purple-600 text-white hover:bg-purple-700' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
              >
                {primaryLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

