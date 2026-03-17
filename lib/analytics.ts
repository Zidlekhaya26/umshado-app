import { supabase } from '@/lib/supabaseClient';

export type VendorEventType = 'profile_view' | 'save_vendor' | 'quote_requested' | 'message_started' | 'package_view' | 'contact_click' | 'quote_accepted' | 'quote_declined';

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

    // Don't count a vendor viewing their own profile
    const { data: vendorOwner } = await supabase
      .from('vendors')
      .select('user_id')
      .eq('id', vendorId)
      .maybeSingle();
    if (vendorOwner?.user_id === user.id) return;

    await supabase.from('vendor_events').insert({
      vendor_id: vendorId,
      actor_id: user.id,
      event_type: eventType,
      meta
    });

    // Fire-and-forget notification for view and save events
    if (eventType === 'profile_view' || eventType === 'save_vendor') {
      fetch(`/api/vendor/${vendorId}/event-notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventType, actorId: user.id }),
      }).catch(() => {});
    }
  } catch (err) {
    console.error('analytics: failed to track vendor event', err);
  }
}
