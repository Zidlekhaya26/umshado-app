import { supabase } from './supabaseClient';

/**
 * After sign-in or sign-up, determine where to redirect the user.
 *
 * Logic:
 * 1. Fetch profile from Supabase
 * 2. If no profile → redirect to role selection (couple or vendor onboarding)
 * 3. If profile exists → redirect based on active_role
 */
export async function getPostAuthRedirect(
  intendedRole?: 'couple' | 'vendor' | null
): Promise<string> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return '/auth/sign-in';

    // Check if profile exists
    const { data: profile } = await supabase
      .from('profiles')
      .select('active_role, has_couple, has_vendor')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile) {
      // No profile at all — new user, route to onboarding based on intended role
      const role = intendedRole || 'couple';

      // Create profile with initial role. Ensure we set `active_role` (DB column)
      await supabase.from('profiles').upsert({
        id: user.id,
        active_role: role,
        has_couple: role === 'couple',
        has_vendor: role === 'vendor',
      });

      return role === 'vendor' ? '/vendor/onboarding' : '/couple/onboarding';
    }

    // Profile exists — check if there's an existing vendor row first.
    // Some older accounts may have vendor rows but not have profile flags set,
    // so prefer vendor when a vendor record exists for this user.
    let activeRole: 'vendor' | 'couple' | null = null;
    try {
      const { data: vendorRow } = await supabase
        .from('vendors')
        .select('id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (vendorRow && vendorRow.id) {
        // Backfill has_vendor flag for legacy accounts — but do NOT force active_role.
        // The user may have manually switched to couple view via /switch-role; we must
        // respect that choice. Only write the flag if it isn't already set.
        if (!profile.has_vendor) {
          try {
            await supabase.from('profiles').update({ has_vendor: true }).eq('id', user.id);
            profile.has_vendor = true;
          } catch (e) {
            // non-fatal
          }
        }
        // Do not set activeRole here — let the fallback logic below read
        // profile.active_role (the user's last explicit choice).
      }
    } catch (err) {
      // ignore and continue to legacy checks below
    }

    // If vendor wasn't detected via vendors table, fall back to existing logic:
    if (!activeRole) {
      // Fresh signup: profile was auto-created by DB trigger with default
      // active_role='couple', but user hasn't completed any onboarding yet.
      // In this case, honour the intendedRole the user chose on the sign-up page.
      const isBlankProfile = !profile.has_couple && !profile.has_vendor;

      if (isBlankProfile && intendedRole) {
        activeRole = intendedRole;
        // Persist the chosen role so subsequent loads are consistent
        await supabase.from('profiles').update({
          active_role: intendedRole,
          has_couple: intendedRole === 'couple',
          has_vendor: intendedRole === 'vendor',
        }).eq('id', user.id);
      } else if (profile.active_role === 'vendor' || profile.active_role === 'couple') {
        activeRole = profile.active_role;
      } else if (profile.has_vendor) {
        activeRole = 'vendor';
      } else if (profile.has_couple) {
        activeRole = 'couple';
      } else if (intendedRole) {
        activeRole = intendedRole;
      } else {
        activeRole = 'couple';
      }
    }

    if (activeRole === 'vendor') {
      if (!profile.has_vendor) {
        // Mark vendor flag so middleware allows vendor routes
        await supabase.from('profiles').update({
          active_role: 'vendor',
          has_vendor: true,
        }).eq('id', user.id);
      }

      // Check if vendor has completed basic onboarding (business_name filled in)
      try {
        const { data: vendorBasicInfo } = await supabase
          .from('vendors')
          .select('business_name')
          .eq('user_id', user.id)
          .limit(1)
          .maybeSingle();

        // If basic info (business_name) is not filled, redirect to complete basic onboarding
        if (!vendorBasicInfo?.business_name) {
          return '/vendor/onboarding';
        }

        // Basic info is complete — send to dashboard
        // (dashboard will show CTAs for services/packages/media if needed)
        return '/vendor/dashboard';
      } catch (e) {
        console.warn('Could not determine vendor onboarding status during post-auth routing', e);
        // Default to dashboard if error checking
        return '/vendor/dashboard';
      }
    }

    if (activeRole === 'couple') {
      if (!profile.has_couple) {
        await supabase.from('profiles').update({
          active_role: 'couple',
          has_couple: true,
        }).eq('id', user.id);
        return '/couple/onboarding';
      }
      return '/couple/dashboard';
    }

    // Default fallback
    return intendedRole === 'vendor' ? '/vendor/onboarding' : '/couple/onboarding';
  } catch (err) {
    console.error('Error determining post-auth redirect:', err);
    // Fallback based on intended role
    return intendedRole === 'vendor' ? '/vendor/onboarding' : '/couple/onboarding';
  }
}

/**
 * Set auth cookies so middleware can detect the session.
 * Note: The supabaseClient now handles this automatically via onAuthStateChange,
 * but we keep this function for backward compatibility and explicit cookie setting.
 */
export function setAuthCookies(session: any) {
  try {
    if (typeof window === 'undefined') return; // Server-side guard
    
    if (session?.access_token) {
      const maxAge = 60 * 60 * 24 * 7; // 7 days
      const secure = window.location.protocol === 'https:';
      const cookieOptions = `path=/; max-age=${maxAge}; samesite=lax${secure ? '; secure' : ''}`;
      
      document.cookie = `sb-access-token=${session.access_token}; ${cookieOptions}`;
      if (session.refresh_token) {
        document.cookie = `sb-refresh-token=${session.refresh_token}; ${cookieOptions}`;
      }
    }
  } catch (err) {
    console.debug('Could not set auth cookies:', err);
  }
}
