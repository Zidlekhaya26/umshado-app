'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import { LOCKED_CATEGORIES } from '@/lib/marketplaceCategories';
import FilterSelect from '@/components/ui/FilterSelect';
import { getServicesCatalog, type Service as CatalogService } from '@/lib/vendorServices';
import { UmshadoIcon } from '@/components/ui/UmshadoLogo';
import BottomNav from '@/components/BottomNav';
import VendorBottomNav from '@/components/VendorBottomNav';
import VerifiedBadge from '@/components/ui/VerifiedBadge';

interface MarketplaceVendor {
  vendor_id: string;
  business_name: string;
  category: string;
  city: string;
  country: string;
  description: string;
  verified?: boolean;
  created_at: string;
  updated_at: string;
  featured?: boolean | null;
  featured_until?: string | null;
  plan?: string | null;
  plan_until?: string | null;
  logo_url?: string | null;
  is_published?: boolean;
  min_from_price: number | null;
  services: string[];
  package_count: number;
}

interface VendorActivityScore {
  vendor_id: string;
  profile_views: number;
  quotes: number;
  messages: number;
  saves: number;
  activity_score: number;
}

interface Vendor {
  id: string;
  name: string;
  category: string;
  location: string;
  fromPrice: number;
  services: string[];
  score: number;
  logoUrl?: string | null;
  verified?: boolean;
}

type SortOption = 'recommended' | 'price_low' | 'price_high' | 'newest';

export default function Marketplace() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [serviceFilter, setServiceFilter] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>('recommended');
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [allVendors, setAllVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(false);
  const [allServices, setAllServices] = useState<string[]>([]);
  const [catalogServices, setCatalogServices] = useState<CatalogService[]>([]);
  const [couplePreferences, setCouplePreferences] = useState<{category?: string; services?: string[]}>({});
  const [displayedCount, setDisplayedCount] = useState(10);
  const [isVendor, setIsVendor] = useState(false);

  useEffect(() => {
    loadData();
    // Detect active role for nav
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: profile } = await supabase.from('profiles').select('active_role').eq('id', user.id).maybeSingle();
        setIsVendor(profile?.active_role === 'vendor');
      } catch { /* ignore */ }
    })();
  }, []);

  useEffect(() => {
    applyFiltersAndSort();
    setDisplayedCount(10);
  }, [searchQuery, categoryFilter, serviceFilter, sortBy, allVendors]);

  // When category changes, clear service filter chips (old selections may not apply)
  useEffect(() => {
    setServiceFilter([]);
  }, [categoryFilter]);

  // Derive displayed services: if a category is selected, show catalog services for that category;
  // otherwise show the union of all vendor services
  const displayedServices = categoryFilter
    ? catalogServices
        .filter(s => s.category === categoryFilter)
        .map(s => s.name)
    : allServices;

  const loadData = async () => {
    setLoading(true);
    try {
      // Fetch couple preferences for ranking
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: coupleData } = await supabase
          .from('couples')
          .select('location, country')
          .eq('id', user.id)
          .maybeSingle();
        
        if (coupleData) {
          setCouplePreferences({ category: coupleData.location });
        }
      }

      // Fetch marketplace vendors
      const { data, error } = await supabase
        .from('marketplace_vendors')
        .select('*');

      if (error) {
        console.error('marketplace: failed to load vendors', error);
        setLoading(false);
        return;
      }

      const { data: activityData, error: activityError } = await supabase
        .rpc('get_vendor_activity_7d');

      if (activityError) {
        if (activityError.code !== 'PGRST202') {
          console.warn('marketplace: failed to load vendor activity counts', activityError);
        }
      }

      const activityMap = new Map<string, VendorActivityScore>();
      (activityData || []).forEach((row: VendorActivityScore) => {
        activityMap.set(row.vendor_id, row);
      });

      const mapped: Vendor[] = (data || []).map((v: MarketplaceVendor) => {
        const activity = activityMap.get(v.vendor_id);
        return {
          id: v.vendor_id,
          name: v.business_name || 'Unnamed Vendor',
          category: v.category || 'Other',
          location: [v.city, v.country].filter(Boolean).join(', ') || 'Location not set',
          fromPrice: v.min_from_price || 0,
          services: v.services || [],
          score: calculateScore(v, couplePreferences, activity),
          logoUrl: v.logo_url || null
          ,
          verified: !!v.verified
        };
      });

      // Extract unique services from vendors (used when no category is selected)
      const servs = Array.from(new Set(mapped.flatMap(v => v.services)));
      setAllServices(servs);

      // Load full service catalog for category-aware filtering
      try {
        const catalog = await getServicesCatalog();
        setCatalogServices(catalog);
      } catch (err) {
        console.warn('marketplace: failed to load service catalog', err);
      }

      setAllVendors(mapped);
    } catch (err) {
      console.error('marketplace: unexpected error loading vendors', err);
    } finally {
      setLoading(false);
    }
  };

  const calculateScore = (
    vendor: MarketplaceVendor,
    preferences: {category?: string; services?: string[]},
    activity?: VendorActivityScore
  ): number => {
    let score = 0;

    // +50 if vendor category matches couple preferred category
    if (preferences.category && vendor.category && 
        vendor.category.toLowerCase().includes(preferences.category.toLowerCase())) {
      score += 50;
    }

    // +10 per matched service (if couple has preferred services)
    if (preferences.services && preferences.services.length > 0) {
      const matches = vendor.services.filter(s => 
        preferences.services!.some(ps => s.toLowerCase().includes(ps.toLowerCase()))
      );
      score += matches.length * 10;
    }

    // +25 if vendor has 2-3 packages and services (complete profile)
    if (vendor.package_count >= 2 && vendor.package_count <= 3 && vendor.services.length > 0) {
      score += 25;
    }

    // +5 if has pricing
    if (vendor.min_from_price && vendor.min_from_price > 0) {
      score += 5;
    }

    // + activity-based boost from true counts (last 7 days)
    if (activity) {
      score += Math.min(30, activity.activity_score);
    }

    // Strong boost for active featured vendors
    if (vendor.featured && vendor.featured_until) {
      const until = new Date(vendor.featured_until).getTime();
      if (!Number.isNaN(until) && until > Date.now()) {
        score += 250;
      }
    }

    return score;
  };

  const applyFiltersAndSort = () => {
    let filtered = [...allVendors];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(v => 
        v.name.toLowerCase().includes(query) ||
        v.category.toLowerCase().includes(query) ||
        v.location.toLowerCase().includes(query)
      );
    }

    // Apply category filter
    if (categoryFilter) {
      filtered = filtered.filter(v => v.category === categoryFilter);
    }

    // Apply service filter
    if (serviceFilter.length > 0) {
      filtered = filtered.filter(v => 
        serviceFilter.some(sf => v.services.some(s => s.toLowerCase().includes(sf.toLowerCase())))
      );
    }

    // Apply sorting
    switch (sortBy) {
      case 'recommended':
        filtered.sort((a, b) => b.score - a.score);
        break;
      case 'price_low':
        filtered.sort((a, b) => {
          if (a.fromPrice === 0) return 1;
          if (b.fromPrice === 0) return -1;
          return a.fromPrice - b.fromPrice;
        });
        break;
      case 'price_high':
        filtered.sort((a, b) => b.fromPrice - a.fromPrice);
        break;
      case 'newest':
        // Already have score, but can sort by id or name as fallback
        filtered.sort((a, b) => b.name.localeCompare(a.name));
        break;
    }

    setVendors(filtered);
  };

  const filterOptions = [
    { label: 'Category', icon: '📋' },
    { label: 'Location', icon: '📍' },
    { label: 'Price', icon: '💰' },
    { label: 'Availability', icon: '📅' }
  ];

  const toggleServiceFilter = (service: string) => {
    if (serviceFilter.includes(service)) {
      setServiceFilter(serviceFilter.filter(s => s !== service));
    } else {
      setServiceFilter([...serviceFilter, service]);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile-first container wrapper */}
      <div className="w-full max-w-screen-xl mx-auto min-h-screen bg-white shadow-lg flex flex-col px-4">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-4 py-5">
          <div className="flex items-center gap-3">
            <UmshadoIcon size={28} />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Marketplace</h1>
              <p className="text-sm text-gray-600 mt-0.5">Discover amazing vendors for your special day</p>
            </div>
          </div>
        </div>

        {/* Consolidated Sticky Filter/Search */}
        <div className="sticky top-0 z-20 bg-white border-b border-gray-200">
          <div className="px-4 pt-3 pb-3">
            <div className="flex flex-col gap-3">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search vendors..."
                  className="w-full pl-11 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-base placeholder:text-gray-400 bg-white text-gray-800"
                />
                <svg
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
                <div className="sm:flex-1">
                  <FilterSelect value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                    <option value="">All Categories</option>
                    {LOCKED_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </FilterSelect>
                </div>

                <div className="sm:w-48 w-full">
                  <FilterSelect value={sortBy} onChange={(e) => setSortBy(e.target.value as SortOption)}>
                    <option value="recommended">Recommended</option>
                    <option value="price_low">Lowest Price</option>
                    <option value="price_high">Highest Price</option>
                    <option value="newest">Newest</option>
                  </FilterSelect>
                </div>
              </div>

              {displayedServices.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-2">Filter by service</p>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {displayedServices.map((service) => (
                      <button
                        key={service}
                        onClick={() => toggleServiceFilter(service)}
                        className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                          serviceFilter.includes(service)
                            ? 'bg-purple-600 text-white shadow'
                            : 'bg-white text-gray-700 border border-gray-200 hover:bg-purple-50'
                        }`}
                      >
                        {service}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Vendor Cards List */}
        <div className="flex-1 px-4 pb-28 space-y-3 overflow-y-auto">
          <p className="text-xs font-medium text-gray-500 mb-2">
            {loading ? 'Loading vendors...' : `${vendors.length} vendor${vendors.length !== 1 ? 's' : ''} available`}
          </p>

          {!loading && vendors.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="opacity-15 mb-4"><UmshadoIcon size={64} /></div>
              <p className="text-sm text-gray-500 font-medium">No vendors found</p>
              <p className="text-xs text-gray-400 mt-1">Try adjusting your filters or check back soon</p>
            </div>
          )}

          {vendors.slice(0, displayedCount).map((vendor) => (
            <Link
              key={vendor.id}
              href={`/marketplace/vendor/${vendor.id}`}
              className="block bg-white rounded-xl border-2 border-gray-100 p-4 shadow-sm hover:shadow-md hover:border-purple-300 transition-all active:scale-[0.98]"
            >
              <div className="space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex-shrink-0">
                      {vendor.logoUrl ? (
                        <div className="w-11 h-11 rounded-full overflow-hidden border border-gray-100 flex items-center justify-center bg-white">
                          <img src={vendor.logoUrl} alt={vendor.name || 'vendor'} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-11 h-11 rounded-full flex items-center justify-center bg-gray-100 text-gray-600 font-semibold">
                          {vendor.name ? vendor.name.split(' ').map(s => s[0]).slice(0,2).join('').toUpperCase() : 'V'}
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-gray-900 leading-tight truncate">
                          {vendor.name}
                        </h3>
                      </div>
                      <p className="text-sm text-gray-600 mt-0.5">{vendor.category}</p>
                    </div>
                  </div>

                  <div className="flex-shrink-0 ml-3 self-start">
                    <VerifiedBadge verified={vendor.verified} />
                  </div>
                </div>

                {/* Location */}
                <div className="flex items-center gap-1.5 text-sm text-gray-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>{vendor.location}</span>
                </div>

                {/* Services Chips (top 4) */}
                {vendor.services.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {vendor.services.slice(0, 4).map((service, idx) => (
                      <span
                        key={idx}
                        className="inline-block px-2 py-1 bg-purple-50 text-purple-700 text-xs font-medium rounded-md border border-purple-200"
                      >
                        {service}
                      </span>
                    ))}
                    {vendor.services.length > 4 && (
                      <span className="inline-block px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-md">
                        +{vendor.services.length - 4} more
                      </span>
                    )}
                  </div>
                )}

                {/* Price & CTA */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  {vendor.fromPrice > 0 ? (
                    <p className="text-lg font-bold text-purple-600">
                      From R{vendor.fromPrice.toLocaleString()}
                    </p>
                  ) : (
                    <p className="text-sm text-gray-500">Contact for pricing</p>
                  )}
                  <div className="flex items-center gap-2">
                    {!isVendor && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          router.push(`/messages/new?vendorId=${vendor.id}`);
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 border-2 border-purple-200 text-purple-600 rounded-lg text-xs font-semibold hover:bg-purple-50 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        Chat
                      </button>
                    )}
                    <div className="flex items-center gap-1 text-purple-600">
                      <span className="text-sm font-semibold">View</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}

          {/* Load More Button */}
          {!loading && vendors.length > displayedCount && (
            <button
              onClick={() => setDisplayedCount(prev => prev + 10)}
              className="w-full py-3 mt-2 bg-purple-50 text-purple-700 rounded-xl font-semibold text-sm border-2 border-purple-200 hover:bg-purple-100 active:scale-[0.98] transition-all"
            >
              Load more ({vendors.length - displayedCount} remaining)
            </button>
          )}
        </div>

        {isVendor ? <VendorBottomNav /> : <BottomNav />}
      </div>
    </div>
  );
}
