"use client";

import React, { useMemo, useState } from "react";
import FilterSelect from "@/components/ui/FilterSelect";

type Props = {
  searchQuery: string;
  setSearchQuery: (s: string) => void;
  categoryFilter: string;
  setCategoryFilter: (s: string) => void;
  sortBy: string;
  setSortBy: (s: string) => void;
  categories: string[];
  displayedServices: string[];
  serviceFilter: string[];
  toggleServiceFilter: (s: string) => void;
  onClear?: () => void;
  activeCount?: number;
};

export default function LuxuryFilters({
  searchQuery,
  setSearchQuery,
  categoryFilter,
  setCategoryFilter,
  sortBy,
  setSortBy,
  categories,
  displayedServices,
  serviceFilter,
  toggleServiceFilter,
  onClear,
  activeCount,
}: Props) {
  const [open, setOpen] = useState(false);

  const internalActiveCount = useMemo(() => {
    let count = 0;
    if (categoryFilter) count += 1;
    if (sortBy && sortBy !== "recommended") count += 1;
    if (serviceFilter && serviceFilter.length) count += 1;
    if (searchQuery && searchQuery.trim()) count += 1;
    return count;
  }, [categoryFilter, sortBy, serviceFilter?.length, searchQuery]);

  const shownActiveCount = typeof activeCount === "number" && activeCount > 0 ? activeCount : internalActiveCount;

  return (
    <>
      {/* Sticky compact bar */}
      <div className="sticky top-0 z-20 bg-[#FBF6F0] border-b border-gray-100">
        <div className="px-4 pt-3 pb-3">
          <div className="space-y-2">
            {/* Search - smaller */}
            <div className="relative">
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search vendors, services, or locations"
                className="w-full h-10 pl-10 pr-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-200"
              />
              <span className="absolute left-3 top-2.5 text-gray-400">🔎</span>
            </div>

            {/* Row: Category + Sort + Filters button */}
            <div className="grid grid-cols-2 gap-2">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm"
              >
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm"
              >
                <option value="recommended">Recommended</option>
                <option value="price_low">Price: Low</option>
                <option value="price_high">Price: High</option>
                <option value="newest">Newest</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => setOpen(true)}
              className="w-full h-10 rounded-xl border border-purple-200 bg-purple-50 text-purple-700 text-sm font-semibold flex items-center justify-center gap-2"
            >
              <span>Filters</span>
              {shownActiveCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-purple-600 text-white text-xs">
                  {shownActiveCount}
                </span>
              )}
            </button>

            {/* OPTIONAL: show selected service chips as one-line horizontal scroll */}
            {serviceFilter && serviceFilter.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {serviceFilter.slice(0, 6).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleServiceFilter(s)}
                    className="shrink-0 px-3 py-1 rounded-full border border-purple-200 bg-purple-50 text-purple-700 text-xs"
                  >
                    {s} ✕
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom sheet modal for service chips */}
      {open && (
        <div className="fixed inset-0 z-50">
          <button
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            aria-label="Close filters"
          />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-xl max-h-[80vh] overflow-y-auto">
            <div className="px-4 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <p className="text-base font-bold text-gray-900">Filters</p>
                <p className="text-xs text-gray-500">Select services to refine results</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm"
              >
                Done
              </button>
            </div>

            <div className="px-4 py-4">
              <p className="text-sm font-semibold text-gray-900 mb-2">Services</p>
              <div className="flex flex-wrap gap-2">
                {displayedServices.map((service) => {
                  const active = serviceFilter.includes(service);
                  return (
                    <button
                      key={service}
                      type="button"
                      onClick={() => toggleServiceFilter(service)}
                      className={[
                        "px-3 py-1.5 rounded-full text-xs font-medium border",
                        active
                          ? "bg-purple-600 text-white border-purple-600"
                          : "bg-white text-gray-700 border-gray-200",
                      ].join(" ")}
                    >
                      {service}
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    // Clear services only (safe)
                    serviceFilter.slice().forEach((s) => toggleServiceFilter(s));
                  }}
                  className="flex-1 h-10 rounded-xl border border-gray-200 text-sm font-semibold"
                >
                  Clear services
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 h-10 rounded-xl bg-purple-600 text-white text-sm font-semibold"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* High-specificity fallback to override any global cascade issues */}
      <style dangerouslySetInnerHTML={{ __html: `
        .luxury-filter-chip[data-selected="true"]{
          background-color: #7A1E3A !important;
          color: #ffffff !important;
          border-color: #7A1E3A !important;
          box-shadow: 0 10px 20px rgba(122,30,58,0.18) !important;
        }
      ` }} />
    </>
  );
}
