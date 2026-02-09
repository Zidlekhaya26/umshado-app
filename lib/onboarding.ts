import { supabase } from './supabaseClient';

export async function getUserOrRedirect(): Promise<any | null> {
  try {
    const { data: userData, error } = await supabase.auth.getUser();
    if (error || !userData?.user) return null;
    return userData.user;
  } catch (err) {
    console.error('getUserOrRedirect error:', err);
    return null;
  }
}

export async function ensureProfile(userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: userId, role: 'couple' }, { onConflict: 'id', ignoreDuplicates: true });

    if (error) {
      console.error('ensureProfile insert error:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('ensureProfile unexpected error:', err);
    return false;
  }
}

export async function upsertCouple(userId: string, data: {
  partner_name?: string | null;
  wedding_date?: string | null;
  location?: string | null;
  country?: string | null;
  cultural_preferences?: string | null;
}): Promise<{ success: boolean; error?: string }> {
  try {
    // Only include columns that are present in the couples table schema.
    const payload: any = {
      id: userId,
      partner_name: data.partner_name ?? null,
      wedding_date: data.wedding_date ?? null,
      location: data.location ?? null,
      country: data.country ?? null
    };

    if (data.cultural_preferences) {
      payload.cultural_preferences = data.cultural_preferences;
    }

    let { error: upsertErr } = await supabase
      .from('couples')
      .upsert(payload);

    if (upsertErr && upsertErr.message?.includes("cultural_preferences")) {
      delete payload.cultural_preferences;
      const retry = await supabase
        .from('couples')
        .upsert(payload);
      upsertErr = retry.error;
    }

    if (upsertErr) {
      console.error('upsertCouple error:', upsertErr);
      return { success: false, error: upsertErr.message };
    }

    // Ensure profile role is 'couple'
    const { error: profileErr } = await supabase
      .from('profiles')
      .update({ role: 'couple', has_couple: true, active_role: 'couple' })
      .eq('id', userId);

    if (profileErr) console.warn('upsertCouple - profile role update warning:', profileErr.message);

    return { success: true };
  } catch (err: any) {
    console.error('upsertCouple unexpected error:', err);
    return { success: false, error: err.message };
  }
}

export async function upsertVendor(userId: string, data: {
  business_name?: string | null;
  category?: string | null;
  location?: string | null;
  description?: string | null;
}): Promise<{ success: boolean; vendorId?: string; error?: string }> {
  try {
    const fields: any = {
      business_name: data.business_name ?? null,
      category: data.category ?? null,
      location: data.location ?? null,
      description: data.description ?? null,
      updated_at: new Date().toISOString()
    };

    // Find existing vendor row — could be id=userId OR user_id=userId
    let existingId: string | null = null;

    const { data: byUserId } = await supabase
      .from('vendors')
      .select('id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (byUserId) {
      existingId = byUserId.id;
    } else {
      const { data: byId } = await supabase
        .from('vendors')
        .select('id')
        .eq('id', userId)
        .maybeSingle();
      if (byId) existingId = byId.id;
    }

    let upsertErr: any = null;
    let attempts = 0;

    if (existingId) {
      // UPDATE existing row
      const payload = { ...fields };
      while (attempts < 3) {
        const { error } = await supabase
          .from('vendors')
          .update(payload)
          .eq('id', existingId);
        upsertErr = error;

        if (!upsertErr || !upsertErr.message) break;

        const match = upsertErr.message.match(/'([^']+)'/);
        const missingColumn = match?.[1];
        if (missingColumn && missingColumn in payload) {
          delete payload[missingColumn];
          attempts += 1;
          continue;
        }
        break;
      }
    } else {
      // INSERT new row with id=userId
      const payload: any = { id: userId, user_id: userId, ...fields };
      while (attempts < 3) {
        const { error } = await supabase
          .from('vendors')
          .insert(payload);
        upsertErr = error;

        if (!upsertErr || !upsertErr.message) break;

        const match = upsertErr.message.match(/'([^']+)'/);
        const missingColumn = match?.[1];
        if (missingColumn && missingColumn in payload) {
          delete payload[missingColumn];
          attempts += 1;
          continue;
        }
        break;
      }
    }

    if (upsertErr) {
      console.error('upsertVendor error:', upsertErr);
      return { success: false, error: upsertErr.message };
    }

    const vendorId = existingId || userId;

    const { error: roleErr } = await supabase
      .from('profiles')
      .upsert({ id: userId, role: 'vendor', has_vendor: true, active_role: 'vendor' }, { onConflict: 'id' });

    if (roleErr) {
      console.error('upsertVendor role update error:', roleErr);
      return { success: false, error: `Profile update failed: ${roleErr.message}` };
    }

    return { success: true, vendorId };
  } catch (err: any) {
    console.error('upsertVendor exception:', err);
    return { success: false, error: err.message || 'Unknown error' };
  }
}

export default {
  getUserOrRedirect,
  ensureProfile,
  upsertCouple,
  upsertVendor
};
