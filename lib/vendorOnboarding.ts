import type { SupabaseClient } from '@supabase/supabase-js';

export async function getVendorSetupStatus(supabase: SupabaseClient, vendorId: string) {
  const missing: string[] = [];

  // services selected
  const servicesRes = await supabase
    .from('vendor_selected_services')
    .select('id')
    .eq('vendor_id', vendorId)
    .limit(1);

  const hasServices = (servicesRes.data?.length || 0) > 0;
  if (!hasServices) missing.push('services');

  // packages
  const packagesRes = await supabase
    .from('vendor_packages')
    .select('id')
    .eq('vendor_id', vendorId)
    .limit(2);

  const hasPackages = (packagesRes.data?.length || 0) >= 2;
  if (!hasPackages) missing.push('packages');

  // media (at least 1 image OR 1 video url)
  const mediaRes = await supabase
    .from('vendor_media')
    .select('id, type')
    .eq('vendor_id', vendorId)
    .limit(1);

  const hasMedia = (mediaRes.data?.length || 0) > 0;
  if (!hasMedia) missing.push('media');

  return {
    needsOnboarding: missing.length > 0,
    missing,
  };
}
