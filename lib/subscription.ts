/**
 * uMshado Vendor Subscription Utilities
 *
 * Tiers:
 *   trial  — first 30 days, all features except verification
 *   free   — after trial: limited packages (2), photos (6), analytics (7 days)
 *   pro    — R49.99/mo or R499/yr: all features unlocked
 *
 * Add-ons (separate, any tier):
 *   verification — R99 one-time
 *   boost        — R199/month (featured + marketplace ads + community ads)
 */

export type SubscriptionTier = 'trial' | 'free' | 'pro';

export interface VendorSubscription {
  subscription_tier?: string | null;
  subscription_status?: string | null;
  trial_started_at?: string | null;
  subscription_expires_at?: string | null;
  verified?: boolean | null;
  verification_paid_at?: string | null;
  verification_status?: string | null;
  created_at?: string | null;
}

export type Feature =
  | 'unlimited_packages'
  | 'unlimited_photos'
  | 'whatsapp_button'
  | 'full_analytics'
  | 'verification_eligible'
  | 'boost_eligible';

const TRIAL_DAYS = 30;

// Features available on trial (everything except verification)
const TRIAL_FEATURES: Feature[] = [
  'unlimited_packages',
  'unlimited_photos',
  'whatsapp_button',
  'full_analytics',
  'boost_eligible',
];

// Features only on Pro
const PRO_FEATURES: Feature[] = [
  'unlimited_packages',
  'unlimited_photos',
  'whatsapp_button',
  'full_analytics',
  'verification_eligible',
  'boost_eligible',
];

export function getEffectiveTier(v: VendorSubscription): SubscriptionTier {
  // Check active pro subscription
  if (v.subscription_tier === 'pro' && v.subscription_status === 'active') {
    const exp = v.subscription_expires_at;
    if (!exp || new Date(exp) > new Date()) return 'pro';
  }

  // Check trial — use trial_started_at or fall back to created_at
  const trialStart = v.trial_started_at || v.created_at;
  if (trialStart) {
    const trialEnd = new Date(trialStart);
    trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS);
    if (new Date() < trialEnd) return 'trial';
  }

  return 'free';
}

export function getTrialDaysLeft(v: VendorSubscription): number {
  const trialStart = v.trial_started_at || v.created_at;
  if (!trialStart) return 0;
  const trialEnd = new Date(trialStart);
  trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS);
  const diff = trialEnd.getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export function canUseFeature(v: VendorSubscription, feature: Feature): boolean {
  const tier = getEffectiveTier(v);
  if (tier === 'pro') return PRO_FEATURES.includes(feature);
  if (tier === 'trial') return TRIAL_FEATURES.includes(feature);
  return false; // free tier: all premium features locked
}

export const PACKAGE_LIMIT: Record<SubscriptionTier, number> = {
  trial: Infinity,
  pro: Infinity,
  free: 2,
};

export const PHOTO_LIMIT: Record<SubscriptionTier, number> = {
  trial: Infinity,
  pro: Infinity,
  free: 6,
};

export const ANALYTICS_DAYS: Record<SubscriptionTier, number> = {
  trial: 90,
  pro: 90,
  free: 7,
};

export function getProPriceMonthly() { return 4999; }  // cents → R49.99
export function getProPriceYearly()  { return 49900; } // cents → R499
export function getVerificationFee() { return 9900; }  // cents → R99
export function getBoostFee()        { return 19900; } // cents → R199
