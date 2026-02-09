/**
 * Canonical service catalog categories for the uMshado marketplace.
 *
 * Each category has a pricing type and an MVP flag. Phase 2 categories
 * are seeded in the DB but hidden from couple/vendor UI until launch.
 *
 * IMPORTANT: category names here MUST match the `category` column
 * in the `services` table exactly.
 */

export type PricingType =
  | 'guest-based'
  | 'time-based'
  | 'per-person'
  | 'package-based'
  | 'event-based'
  | 'quantity-based';

export interface CategoryMeta {
  /** Display name — must match DB `services.category` exactly */
  name: string;
  /** How this category's packages are priced */
  pricingType: PricingType;
  /** Show in MVP UI? Phase 2 categories = false */
  isMvp: boolean;
  /** Emoji for quick visual identification */
  icon: string;
}

// ─── Canonical catalog ──────────────────────────────────

export const SERVICE_CATEGORIES: CategoryMeta[] = [
  { name: 'Catering & Food',           pricingType: 'guest-based',   isMvp: true,  icon: '🍽️' },
  { name: 'Décor & Styling',           pricingType: 'guest-based',   isMvp: true,  icon: '💐' },
  { name: 'Photography & Video',       pricingType: 'time-based',    isMvp: true,  icon: '📸' },
  { name: 'Music, DJ & Sound',         pricingType: 'time-based',    isMvp: true,  icon: '🎵' },
  { name: 'Makeup & Hair',             pricingType: 'per-person',    isMvp: true,  icon: '💄' },
  { name: 'Attire & Fashion',          pricingType: 'package-based', isMvp: true,  icon: '👗' },
  { name: 'Wedding Venues',            pricingType: 'event-based',   isMvp: true,  icon: '🏛️' },
  { name: 'Transport',                 pricingType: 'time-based',    isMvp: true,  icon: '🚗' },
  { name: 'Honeymoon & Travel',        pricingType: 'package-based', isMvp: true,  icon: '✈️' },
  { name: 'Support Services',          pricingType: 'event-based',   isMvp: true,  icon: '🛡️' },
  // Phase 2
  { name: 'Furniture & Equipment Hire', pricingType: 'quantity-based', isMvp: false, icon: '🪑' },
  { name: 'Special Effects & Experiences', pricingType: 'event-based', isMvp: false, icon: '✨' },
  { name: 'Planning & Coordination',   pricingType: 'event-based',   isMvp: false, icon: '📋' },
];

// ─── Derived helpers ────────────────────────────────────

/** MVP-only categories shown in UI */
export const MVP_CATEGORIES = SERVICE_CATEGORIES.filter(c => c.isMvp);

/** Category names for MVP (used in filters, dropdowns, ordering) */
export const LOCKED_CATEGORIES = MVP_CATEGORIES.map(c => c.name) as readonly string[];

/** Fast lookup set */
export const LOCKED_CATEGORY_SET = new Set<string>(LOCKED_CATEGORIES);

/** All category names including Phase 2 */
export const ALL_CATEGORY_NAMES = SERVICE_CATEGORIES.map(c => c.name);

/** Map category name → pricing type */
export const PRICING_TYPE_MAP = new Map<string, PricingType>(
  SERVICE_CATEGORIES.map(c => [c.name, c.pricingType]),
);

/** Map category name → emoji icon */
export const CATEGORY_ICON_MAP = new Map<string, string>(
  SERVICE_CATEGORIES.map(c => [c.name, c.icon]),
);

/** Get the pricing type for a category, with a sensible default */
export function getPricingType(category?: string | null): PricingType {
  if (!category) return 'event-based';
  return PRICING_TYPE_MAP.get(category.trim()) ?? 'event-based';
}

/** Normalize a category string (trim whitespace) */
export function normalizeCategory(category?: string | null): string {
  if (!category) return '';
  return category.trim();
}
