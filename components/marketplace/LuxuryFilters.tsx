import React from "react";
import FilterSelect from "@/components/ui/FilterSelect";

interface Props {
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
}

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
}: Props) {
  return (
    <div className="sticky top-0 z-20 px-4 py-3 sm:px-4 sm:py-4 lg:px-6 bg-[#FBF6F0] border-b border-gray-100">
      <div className="w-full">
        <div className="relative bg-white border border-[#F1E6E6] shadow-[0_8px_30px_rgba(122,30,58,0.08)] rounded-2xl sm:rounded-3xl px-3 py-3 sm:px-4 sm:py-4 space-y-4">
          <div className="pointer-events-none absolute inset-0 rounded-2xl sm:rounded-3xl -z-10 opacity-40 bg-gradient-to-br from-[#FAF3F4] via-white to-[#F8F4F0]" />

          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg sm:text-[22px] font-extrabold tracking-tight text-[#2B1B1B]">
                Marketplace
              </h2>
              <p className="text-sm text-[#6B5A5A] mt-0.5">Discover exceptional wedding vendors</p>
            </div>
            <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
              <span className="text-xs font-semibold text-[#7B6A6A] uppercase tracking-wide">Filters</span>
            </div>
          </div>

          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8E7B7B]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>

            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search vendors, services, or locations"
              className="w-full pl-10 pr-4 py-2 sm:py-3 rounded-lg sm:rounded-2xl bg-white border border-[#EFE2E2] shadow-sm placeholder:text-[#B9A7A7] text-[15px] leading-6 text-[#2B1B1B] focus:outline-none focus:ring-2 focus:ring-[#7A1E3A]/15"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="min-w-0">
              <FilterSelect
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full rounded-lg sm:rounded-2xl bg-white border border-[#EFE2E2] px-3 text-[15px] leading-6 text-[#2B1B1B] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#7A1E3A]/15"
              >
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </FilterSelect>
            </div>

            <div className="min-w-0">
              <FilterSelect
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full rounded-lg sm:rounded-2xl bg-white border border-[#EFE2E2] px-3 text-[15px] leading-6 text-[#2B1B1B] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#7A1E3A]/15"
              >
                <option value="recommended">Recommended</option>
                <option value="price_low">Lowest Price</option>
                <option value="price_high">Highest Price</option>
                <option value="newest">Newest</option>
              </FilterSelect>
            </div>
          </div>

          {displayedServices && displayedServices.length > 0 && (
            <div className="flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-hide">
              {displayedServices.map((service) => {
                const selected = serviceFilter.includes(service);
                return (
                  <button
                    key={service}
                    onClick={() => toggleServiceFilter(service)}
                    className={[
                      "px-3 py-2 rounded-full text-xs font-medium whitespace-nowrap",
                      "border border-[#EFE2E2] bg-white text-[#4A3A3A]",
                      "shadow-[0_2px_10px_rgba(0,0,0,0.03)]",
                      selected
                        ? "bg-[#7A1E3A] text-white border-[#7A1E3A] shadow-[0_10px_20px_rgba(122,30,58,0.18)]"
                        : "hover:border-[#D9BABA] hover:bg-[#FFF9F9]",
                    ].join(" ")}
                  >
                    {service}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
