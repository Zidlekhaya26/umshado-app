import { supabase } from './supabaseClient';

export interface Service {
  id: string;
  category: string;
  name: string;
  pricing_type?: string;
  is_mvp?: boolean;
  sort_order?: number;
  is_custom?: boolean;
  icon_key?: string;
}

export interface VendorService {
  id: string;
  vendor_id: string;
  service_id: string | null;
  custom_name: string | null;
}

export interface GroupedServices {
  [category: string]: Service[];
}

/**
 * Get or create a vendor for the current user
 */
export async function getOrCreateVendorForUser(): Promise<string | null> {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.log('No active session');
      return null;
    }

    // Look for existing vendor — try user_id first, then id (legacy rows use id = auth uid)
    const { data: vendorByUserId } = await supabase
      .from('vendors')
      .select('id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (vendorByUserId) return vendorByUserId.id;

    const { data: vendorById } = await supabase
      .from('vendors')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (vendorById) return vendorById.id;

    // No existing vendor — create one
    const { data: newVendor, error: insertErr } = await supabase
      .from('vendors')
      .insert({ id: user.id, user_id: user.id, business_name: 'New Vendor' })
      .select('id')
      .maybeSingle();

    if (!insertErr && newVendor) return newVendor.id;

    // Retry without user_id in case column doesn't exist
    const { data: newVendor2, error: insertErr2 } = await supabase
      .from('vendors')
      .insert({ id: user.id, business_name: 'New Vendor' })
      .select('id')
      .maybeSingle();

    if (insertErr2) {
      console.error('Error creating vendor:', insertErr2);
      return null;
    }

    return newVendor2?.id || null;
  } catch (error) {
    console.error('Error in getOrCreateVendorForUser:', error);
    return null;
  }
}

/**
 * Save or update vendor profile for the current user
 */
export async function saveVendorProfile(profile: {
  business_name: string;
  category?: string;
  location?: string;
  description?: string;
}): Promise<{ success: boolean; vendorId?: string; error?: string }> {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { success: false, error: 'No active session' };
    }

    // Check for existing vendor
    const { data: existingVendor, error: selectError } = await supabase
      .from('vendors')
      .select('id')
      .eq('id', user.id)
      .single();

    if (selectError && selectError.code !== 'PGRST116') {
      console.error('Error selecting vendor:', selectError);
      return { success: false, error: selectError.message };
    }

    if (existingVendor && existingVendor.id) {
      // Update — retry removing unsupported columns reported by PostgREST.
      let updatePayload: any = {
        business_name: profile.business_name,
        category: profile.category || null,
        location: profile.location || null,
        description: profile.description || null,
        updated_at: new Date().toISOString()
      };

      while (Object.keys(updatePayload).length) {
        const { error: updateError } = await supabase
          .from('vendors')
          .update(updatePayload)
          .eq('id', existingVendor.id);

        if (!updateError) break;

        const msg = updateError.message || '';
        const m = msg.match(/Could not find the '([^']+)' column of 'vendors' in the schema cache|column "?([^"']+)"? does not exist/);
        const missingCol = m ? (m[1] || m[2]) : null;
        if (!missingCol) {
          console.error('Error updating vendor:', updateError);
          return { success: false, error: updateError.message };
        }

        delete updatePayload[missingCol];
        console.warn('saveVendorProfile: removed unsupported column and retrying update:', missingCol);
      }

      // Ensure profile role is set to 'vendor'
      const { error: profileUpdateError } = await supabase
        .from('profiles')
        .update({ role: 'vendor' })
        .eq('id', user.id);

      if (profileUpdateError) {
        console.error('Error updating profile role to vendor:', profileUpdateError);
        // not fatal for vendor creation — return success for vendor but include warning
        return { success: true, vendorId: existingVendor.id };
      }

      return { success: true, vendorId: existingVendor.id };
    }

    // Insert new vendor (use user's id)
    // Insert new vendor — retry removing unsupported columns if PostgREST complains.
    let insertPayload: any = {
      user_id: user.id,
      business_name: profile.business_name,
      category: profile.category || null,
      location: profile.location || null,
      description: profile.description || null
    };

    let insertResult: any = null;
    while (Object.keys(insertPayload).length) {
      const res = await supabase.from('vendors').insert(insertPayload).select('id').single();
      insertResult = res;
      if (!res.error) break;

      const msg = res.error?.message || '';
      const m = msg.match(/Could not find the '([^']+)' column of 'vendors' in the schema cache|column "?([^"']+)"? does not exist/);
      const missingCol = m ? (m[1] || m[2]) : null;
      if (!missingCol) {
        console.error('Error inserting vendor:', res.error);
        return { success: false, error: res.error.message };
      }

      delete insertPayload[missingCol];
      console.warn('saveVendorProfile: removed unsupported column and retrying insert:', missingCol);
    }

    if (insertResult?.error) {
      console.error('Error inserting vendor:', insertResult.error);
      return { success: false, error: insertResult.error.message };
    }

    // Update profile role to 'vendor'
    try {
      const { error: profileUpdateError } = await supabase
        .from('profiles')
        .update({ role: 'vendor' })
        .eq('id', user.id);

      if (profileUpdateError) {
        console.error('Error updating profile role to vendor after insert:', profileUpdateError);
      }
    } catch (err) {
      console.error('Unexpected error updating profile role:', err);
    }

    return { success: true, vendorId: insertResult?.data?.id || null };
  } catch (error: any) {
    console.error('Error in saveVendorProfile:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

/**
 * Fetch all services from the catalog, ordered by category and name
 */
export async function getServicesCatalog(): Promise<Service[]> {
  try {
    // Note: some projects don't have an `is_custom` column on `services`.
    // Avoid selecting or filtering on that column to prevent PostgREST errors.
    const { data, error } = await supabase
      .from('services')
      .select('id, category, name, pricing_type, is_mvp, sort_order')
      .eq('is_mvp', true)
      .order('category', { ascending: true })
      .order('sort_order', { ascending: true });

    // Verbose logging to help diagnose empty/opaque errors in the browser
    try {
      console.debug('getServicesCatalog - supabase response data:', data);
      console.debug('getServicesCatalog - supabase response error:', error);
    } catch (logErr) {
      // swallow logging errors to avoid breaking flow
      // (some environments may restrict console operations)
    }

    if (error) {
      console.error('Error fetching services catalog:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getServicesCatalog:', error);
    return [];
  }
}

/**
 * Fetch vendor's selected services
 */
export async function getVendorSelectedServices(vendorId: string): Promise<{
  selectedServiceIds: string[];
  customServices: string[];
}> {
  try {
    if (!vendorId || typeof vendorId !== 'string') {
      console.warn('getVendorSelectedServices called without vendorId');
      return { selectedServiceIds: [], customServices: [] };
    }

    // Strict UUID check: do not query vendor_services unless vendorId is a valid UUID
    const uuidStrict = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i;
    if (!uuidStrict.test(vendorId)) {
      console.warn('getVendorSelectedServices - refusing to query vendor_services for invalid vendorId:', vendorId);
      return { selectedServiceIds: [], customServices: [] };
    }

    // Use Supabase query builder (do not construct PostgREST URLs manually)
    const res = await supabase
      .from('vendor_services')
      .select('service_id, custom_name')
      .eq('vendor_id', vendorId);

    // Detailed debug logging for opaque errors seen in the browser console
    // Structured logging: include vendorId and full supabase error object properties
    try {
      const err = (res as any).error;
      if (err) {
        console.error('getVendorSelectedServices - supabase error for vendorId=', vendorId, {
          message: err.message,
          details: err.details,
          hint: err.hint,
          code: err.code,
          status: (res as any).status
        });
      } else {
        console.debug('getVendorSelectedServices - supabase response for vendorId=', vendorId, { data: (res as any).data });
      }
    } catch (logErr) {
      // swallow logging errors
    }

    const { data, error, status } = res as any;

    if (error) {
      const errObj = error || {};
      return (console.error('Error fetching vendor services:', {
        vendorId,
        message: errObj.message,
        details: errObj.details,
        hint: errObj.hint,
        code: errObj.code,
        status
      }), { selectedServiceIds: [], customServices: [] });
    }

    const selectedServiceIds: string[] = [];
    const customServices: string[] = [];

    data?.forEach((vs: { service_id: string | null; custom_name: string | null }) => {
      if (vs.service_id) {
        selectedServiceIds.push(vs.service_id);
      } else if (vs.custom_name) {
        customServices.push(vs.custom_name);
      }
    });

    return { selectedServiceIds, customServices };
  } catch (error) {
    console.error('Error in getVendorSelectedServices:', error);
    return { selectedServiceIds: [], customServices: [] };
  }
}

/**
 * Save vendor's service selections
 */
export async function saveVendorServices(
  vendorId: string,
  selectedServiceIds: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    // Strict guard: require valid UUID vendorId
    const uuidStrict = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i;
    if (!vendorId || !uuidStrict.test(vendorId)) {
      console.error('saveVendorServices - refusing to operate on invalid vendorId:', vendorId);
      return { success: false, error: 'Invalid vendorId' };
    }

    // Delete existing vendor_services for this vendor
    const { error: deleteError } = await supabase
      .from('vendor_services')
      .delete()
      .eq('vendor_id', vendorId);

    if (deleteError) {
      console.error('Error deleting vendor services for vendorId=', vendorId, {
        message: deleteError.message,
        details: deleteError.details,
        hint: deleteError.hint,
        code: deleteError.code
      });
      return { success: false, error: deleteError.message };
    }

    // Prepare rows to insert (only service_id entries)
    const rowsToInsert = selectedServiceIds
      .filter(Boolean)
      .map((serviceId) => ({ vendor_id: vendorId, service_id: serviceId }));

    if (rowsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('vendor_services')
        .insert(rowsToInsert);

      if (insertError) {
        console.error('Error inserting vendor services for vendorId=', vendorId, {
          message: insertError.message,
          details: insertError.details,
          hint: insertError.hint,
          code: insertError.code
        });
        return { success: false, error: insertError.message };
      }
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error in saveVendorServices:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

/**
 * Group services by category
 */
export function groupServicesByCategory(services: Service[]): GroupedServices {
  return services.reduce((acc: GroupedServices, service) => {
    const category = service.category || 'Other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(service);
    return acc;
  }, {});
}

// Backwards-compatible wrappers matching requested API names
export async function getVendorSelections(vendorId: string) {
  const res = await getVendorSelectedServices(vendorId);
  return res;
}

export async function saveVendorSelections(
  vendorId: string,
  selectedServiceIds: string[]
): Promise<{ success: boolean; error?: string }> {
  return saveVendorServices(vendorId, selectedServiceIds);
}
