import { supabase } from '@/lib/supabaseClient';

export type VendorEventType = 'profile_view' | 'save_vendor' | 'quote_requested' | 'message_started' | 'package_view';

export async function trackVendorEvent(
  vendorId?: string | null,
  eventType?: VendorEventType,
  meta: Record<string, any> = {}
) {
  if (!vendorId || !eventType) return;

  try {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) return;

    await supabase.from('vendor_events').insert({
      vendor_id: vendorId,
      actor_id: user.id,
      event_type: eventType,
      meta
    });
  } catch (err) {
    console.error('analytics: failed to track vendor event', err);
  }
}
