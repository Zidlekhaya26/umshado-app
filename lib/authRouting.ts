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

      // Create profile with initial role
      await supabase.from('profiles').upsert({
        id: user.id,
        role: role,
        active_role: role,
        has_couple: role === 'couple',
        has_vendor: role === 'vendor',
      });

      return role === 'vendor' ? '/vendor/onboarding' : '/couple/onboarding';
    }

    // Profile exists — check if they have the onboarding done
    const activeRole = profile.active_role || intendedRole || 'couple';

    if (activeRole === 'vendor') {
      if (!profile.has_vendor) {
        // Mark vendor flag so middleware allows vendor routes
        await supabase.from('profiles').update({
          active_role: 'vendor',
          has_vendor: true,
        }).eq('id', user.id);
      }
      // Always send vendors to dashboard — it has profile-completeness CTAs
      return '/vendor/dashboard';
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
 */
export function setAuthCookies(session: any) {
  try {
    if (session?.access_token) {
      document.cookie = `sb-access-token=${session.access_token}; path=/`;
    }
    if (session?.refresh_token) {
      document.cookie = `sb-refresh-token=${session.refresh_token}; path=/`;
    }
  } catch (err) {
    console.debug('Could not set auth cookies:', err);
  }
}
