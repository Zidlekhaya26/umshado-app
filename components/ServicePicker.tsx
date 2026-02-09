'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { Service } from '@/lib/vendorServices';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface ServicePickerProps {
  /** The vendor's category name (used for header display) */
  categoryKey: string;
  /** Emoji icon for the category */
  categoryIcon?: string;
  /** All available services grouped by category */
  allServices: Service[];
  /** Currently selected service IDs */
  selectedServiceIds: string[];
  /** Callback when selection changes */
  onChangeSelected: (ids: string[]) => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ServicePicker({
  categoryKey,
  categoryIcon,
  allServices,
  selectedServiceIds,
  onChangeSelected,
}: ServicePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Track draft selection inside the modal (only committed on "Add selected")
  const [draftIds, setDraftIds] = useState<string[]>([]);

  // Services for the displayed category
  const categoryServices = useMemo(
    () => allServices.filter((s) => s.category === categoryKey),
    [allServices, categoryKey],
  );

  // Filtered by search
  const filtered = useMemo(() => {
    if (!search.trim()) return categoryServices;
    const q = search.toLowerCase();
    return categoryServices.filter((s) => s.name.toLowerCase().includes(q));
  }, [categoryServices, search]);

  // Selected services (for chip display)
  const selectedServices = useMemo(
    () => allServices.filter((s) => selectedServiceIds.includes(s.id)),
    [allServices, selectedServiceIds],
  );

  /* ── Open / close helpers ─────────────────────────────────────── */

  const openPicker = useCallback(() => {
    setDraftIds([...selectedServiceIds]);
    setSearch('');
    setIsOpen(true);
  }, [selectedServiceIds]);

  const closePicker = useCallback(() => {
    setIsOpen(false);
    setSearch('');
  }, []);

  const commitDraft = useCallback(() => {
    onChangeSelected(draftIds);
    closePicker();
  }, [draftIds, onChangeSelected, closePicker]);

  /* ── Draft toggle ─────────────────────────────────────────────── */

  const toggleDraft = (id: string) => {
    setDraftIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const selectAll = () => {
    setDraftIds(categoryServices.map((s) => s.id));
  };

  const clearAll = () => {
    // Only clear services in this category from the draft
    const otherCategoryIds = draftIds.filter(
      (id) => !categoryServices.some((s) => s.id === id),
    );
    setDraftIds(otherCategoryIds);
  };

  /* ── Remove chip (immediate save) ────────────────────────────── */

  const removeService = (id: string) => {
    onChangeSelected(selectedServiceIds.filter((x) => x !== id));
  };

  /* ── Focus search on open ─────────────────────────────────────── */

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => searchInputRef.current?.focus());
    }
  }, [isOpen]);

  /* ── Close on ESC ─────────────────────────────────────────────── */

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePicker();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, closePicker]);

  /* ── Backdrop click ───────────────────────────────────────────── */

  const handleBackdrop = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      closePicker();
    }
  };

  /* ── Draft count for this category ───────────────────────────── */
  const draftCountForCategory = draftIds.filter((id) =>
    categoryServices.some((s) => s.id === id),
  ).length;

  /* ── Render ─────────────────────────────────────────────────── */
  return (
    <div>
      {/* ── Header row ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-gray-900">
          {categoryIcon && <span className="mr-1.5">{categoryIcon}</span>}
          {categoryKey}
        </h2>
        <button
          type="button"
          onClick={openPicker}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 text-purple-700 text-sm font-semibold hover:bg-purple-100 active:scale-95 transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add services
        </button>
      </div>

      {/* ── Selected chips ───────────────────────────────────────── */}
      {selectedServices.filter((s) => s.category === categoryKey).length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {selectedServices
            .filter((s) => s.category === categoryKey)
            .map((s) => (
              <span
                key={s.id}
                className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-full bg-purple-50 border border-purple-200 text-purple-800 text-sm font-medium"
              >
                {s.name}
                <button
                  type="button"
                  onClick={() => removeService(s.id)}
                  className="p-0.5 rounded-full hover:bg-purple-200 transition-colors"
                  aria-label={`Remove ${s.name}`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}
        </div>
      ) : (
        <p className="text-sm text-gray-400 italic">No services selected</p>
      )}

      {/* ── Full-screen picker modal ─────────────────────────────── */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
          onClick={handleBackdrop}
        >
          <div
            ref={modalRef}
            className="w-full max-w-md bg-white rounded-t-2xl shadow-xl flex flex-col"
            style={{ maxHeight: '85vh' }}
          >
            {/* Modal header */}
            <div className="px-4 pt-4 pb-3 border-b border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold text-gray-900">
                  {categoryIcon && <span className="mr-1.5">{categoryIcon}</span>}
                  {categoryKey}
                </h3>
                <button
                  type="button"
                  onClick={closePicker}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
                  aria-label="Close"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Search */}
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search services…"
                  className="w-full pl-9 pr-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>

              {/* Select all / Clear */}
              <div className="flex items-center justify-between mt-2.5">
                <span className="text-xs text-gray-500 font-medium">
                  {draftCountForCategory} of {categoryServices.length} selected
                </span>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={selectAll}
                    className="text-xs font-semibold text-purple-600 hover:text-purple-700"
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    onClick={clearAll}
                    className="text-xs font-semibold text-gray-500 hover:text-gray-700"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>

            {/* Service list */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5">
              {filtered.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-6">
                  No services match &quot;{search}&quot;
                </p>
              )}

              {filtered.map((service) => {
                const isChecked = draftIds.includes(service.id);
                return (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => toggleDraft(service.id)}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all ${
                      isChecked
                        ? 'bg-purple-50 border-2 border-purple-400'
                        : 'bg-white border-2 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {/* Checkbox */}
                    <div
                      className={`w-5 h-5 rounded flex-shrink-0 flex items-center justify-center border-2 transition-colors ${
                        isChecked
                          ? 'bg-purple-600 border-purple-600'
                          : 'border-gray-300 bg-white'
                      }`}
                    >
                      {isChecked && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span
                      className={`text-sm font-medium ${
                        isChecked ? 'text-purple-800' : 'text-gray-700'
                      }`}
                    >
                      {service.name}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Sticky bottom actions */}
            <div className="border-t border-gray-200 px-4 py-3 flex gap-3">
              <button
                type="button"
                onClick={closePicker}
                className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold text-sm text-center hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={commitDraft}
                className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-xl font-semibold text-sm text-center hover:bg-purple-700 active:scale-95 transition-all shadow-lg shadow-purple-200"
              >
                Add selected ({draftCountForCategory})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
