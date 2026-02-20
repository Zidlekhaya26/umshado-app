'use client';
export const dynamic = 'force-dynamic';

import { useState, useMemo, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { getPostAuthRedirect, setAuthCookies } from '@/lib/authRouting';
import { BETA_INVITE_ONLY } from '@/lib/betaGate';
import { UmshadoLogo, UmshadoIcon } from '@/components/ui/UmshadoLogo';

interface InviteData {
  email: string;
  name: string;
  role: 'couple' | 'vendor';
}

function SignUpContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const inviteToken = useMemo(() => searchParams?.get('invite') || null, [searchParams]);

  const intendedRole = useMemo(() => {
    const r = searchParams?.get('role');
    return r === 'vendor' ? 'vendor' : 'couple';
  }, [searchParams]);

  const [role, setRole] = useState<'couple' | 'vendor'>(intendedRole);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isLoading, setIsLoading] = useState(false);

  // Invite validation state
  const [inviteStatus, setInviteStatus] = useState<'loading' | 'valid' | 'invalid' | 'none'>('none');
  const [inviteData, setInviteData] = useState<InviteData | null>(null);
  const [inviteError, setInviteError] = useState('');

  // Validate invite token on mount
  useEffect(() => {
    if (!BETA_INVITE_ONLY) {
      setInviteStatus('none');
      return;
    }

    if (!inviteToken) {
      // Beta mode, no invite token → redirect to request-access
      router.replace('/request-access');
      return;
    }

    // Validate the invite token
    setInviteStatus('loading');
    fetch(`/api/invite/validate?token=${encodeURIComponent(inviteToken)}`)
      .then(res => res.json())
      .then(data => {
        if (data.valid) {
          setInviteStatus('valid');
          setInviteData(data.invite);
          setEmail(data.invite.email || '');
        } else {
          setInviteStatus('invalid');
          setInviteError(data.error || 'Invalid invite');
        }
      })
      .catch(() => {
        setInviteStatus('invalid');
        setInviteError('Could not validate invite. Please try again.');
      });
  }, [inviteToken, router]);

  // Get the effective role — invite role takes priority in beta mode
  const effectiveRole = useMemo(() => {
    if (inviteData?.role) return inviteData.role;
    return role || intendedRole;
  }, [inviteData, role, intendedRole]);

  // Keep local role in sync when intended role or invite changes
  useEffect(() => {
    if (inviteData?.role) {
      setRole(inviteData.role);
    } else {
      setRole(intendedRole);
    }
  }, [inviteData, intendedRole]);

  // Show loading while validating invite
  if (BETA_INVITE_ONLY && inviteStatus === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-500 via-purple-600 to-pink-500 flex items-center justify-center p-4">
        <div className="mx-auto w-full max-w-md lg:max-w-6xl lg:px-6 bg-white rounded-2xl shadow-2xl p-8 text-center">
          <div className="animate-umshado-pulse mx-auto mb-4"><UmshadoIcon size={48} /></div>
          <p className="text-gray-600 font-medium">Validating your invite…</p>
        </div>
      </div>
    );
  }

  // Show loading while redirecting (no invite token in beta mode)
  if (BETA_INVITE_ONLY && !inviteToken) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-500 via-purple-600 to-pink-500 flex items-center justify-center p-4">
        <div className="mx-auto w-full max-w-md lg:max-w-6xl lg:px-6 bg-white rounded-2xl shadow-2xl p-8 text-center">
          <div className="animate-umshado-pulse mx-auto mb-4"><UmshadoIcon size={48} /></div>
          <p className="text-gray-600 font-medium">Redirecting…</p>
        </div>
      </div>
    );
  }

  // Show error for invalid/expired/redeemed invites
  if (BETA_INVITE_ONLY && inviteStatus === 'invalid') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-500 via-purple-600 to-pink-500 flex items-center justify-center p-4">
        <div className="mx-auto w-full max-w-md lg:max-w-6xl lg:px-6 bg-white rounded-2xl shadow-2xl p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Invite Not Valid</h1>
          <p className="text-sm text-gray-600 mb-6">{inviteError}</p>

          <div className="space-y-3">
            <Link
              href="/request-access"
              className="block w-full px-6 py-3 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 transition-colors active:scale-95 text-center"
            >
              Request Access
            </Link>
            <Link
              href="/auth/sign-in"
              className="block w-full px-6 py-3 bg-white text-purple-600 border-2 border-purple-200 rounded-xl font-semibold hover:bg-purple-50 transition-colors active:scale-95 text-center"
            >
              Already have an account? Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};
    if (!email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Please enter a valid email';
    }
    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const redeemInvite = async () => {
    if (!inviteToken) return;
    try {
      await fetch('/api/invite/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: inviteToken }),
      });
    } catch (err) {
      console.warn('Could not redeem invite token:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsLoading(true);

    try {
      const redirectOrigin =
        typeof window !== 'undefined'
          ? window.location.origin
          : 'https://www.umshado-app.vercel.app';
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${redirectOrigin}/auth/callback?role=${effectiveRole}`,
        }
      });

      if (error) {
        setErrors({ password: error.message });
        setIsLoading(false);
        return;
      }

      if (data.user) {
        setAuthCookies((data as any).session);

        // Redeem the invite token
        await redeemInvite();

        // Check if email confirmation is required
        if (data.user.identities && data.user.identities.length === 0) {
          alert('Please check your email to confirm your account before signing in.');
          router.push('/auth/sign-in');
          return;
        }

        // Route based on intended role
        const redirect = await getPostAuthRedirect(effectiveRole);
        router.push(redirect);
      }
    } catch (error: any) {
      console.error('Sign up error:', error);
      setErrors({ password: 'An error occurred during sign up' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    try {
      // Redeem invite before OAuth redirect (since user will leave the page)
      await redeemInvite();

      const redirectOrigin =
        typeof window !== 'undefined'
          ? window.location.origin
          : 'https://www.umshado-app.vercel.app';
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${redirectOrigin}/auth/callback?role=${effectiveRole}`
        }
      });
      if (error) {
        alert('Google sign up error: ' + error.message);
      }
    } catch (error: any) {
      console.error('Google sign up error:', error);
      alert('Failed to sign up with Google');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-500 via-purple-600 to-pink-500 flex items-center justify-center p-4">
      <div className="mx-auto w-full max-w-md lg:max-w-6xl lg:px-6 bg-white rounded-2xl shadow-2xl p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-block mb-4">
            <UmshadoLogo iconSize={48} />
          </Link>

          {/* Invite Welcome Banner */}
          {BETA_INVITE_ONLY && inviteData && (
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-4">
              <div className="flex items-center gap-2 justify-center">
                <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm font-semibold text-green-800">
                  Welcome{inviteData.name ? `, ${inviteData.name}` : ''}! Your invite is valid.
                </p>
              </div>
            </div>
          )}

          <h1 className="text-2xl font-bold text-gray-900 mb-2">{
            effectiveRole === 'vendor' ? 'Create your Vendor account' : 'Create your Couple account'
          }</h1>
          <p className="text-sm text-gray-600">
            {effectiveRole === 'vendor'
              ? 'Join uMshado and showcase your wedding services'
              : 'Join uMshado and start planning your perfect wedding'}
          </p>

          {/* Role selector: show only when invite does not lock the role */}
          {!inviteData?.role && (
            <div className="mt-6 mb-4">
              <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
                <button
                  type="button"
                  aria-pressed={role === 'couple'}
                  onClick={() => setRole('couple')}
                  className={`flex-1 py-2 rounded-lg text-sm ${role === 'couple' ? 'bg-white shadow font-semibold text-gray-900' : 'text-gray-700'}`}
                >
                  Couple
                </button>
                <button
                  type="button"
                  aria-pressed={role === 'vendor'}
                  onClick={() => setRole('vendor')}
                  className={`flex-1 py-2 rounded-lg text-sm ${role === 'vendor' ? 'bg-white shadow font-semibold text-gray-900' : 'text-gray-700'}`}
                >
                  Vendor
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Sign Up Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-1.5">Email Address</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); if (errors.email) setErrors({ ...errors, email: '' }); }}
              placeholder="your@email.com"
              readOnly={BETA_INVITE_ONLY && !!inviteData?.email}
              className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors ${errors.email ? 'border-red-500' : 'border-gray-300'} ${BETA_INVITE_ONLY && inviteData?.email ? 'bg-gray-50 text-gray-600 cursor-not-allowed' : ''}`}
            />
            {BETA_INVITE_ONLY && inviteData?.email && (
              <p className="text-xs text-gray-500 mt-1">This email is tied to your invite</p>
            )}
            {errors.email && <p className="text-xs text-red-600 mt-1.5">{errors.email}</p>}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); if (errors.password) setErrors({ ...errors, password: '' }); }}
              placeholder="At least 6 characters"
              className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors ${errors.password ? 'border-red-500' : 'border-gray-300'}`}
            />
            {errors.password && <p className="text-xs text-red-600 mt-1.5">{errors.password}</p>}
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-semibold text-gray-700 mb-1.5">Confirm Password</label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: '' }); }}
              placeholder="Re-enter your password"
              className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors ${errors.confirmPassword ? 'border-red-500' : 'border-gray-300'}`}
            />
            {errors.confirmPassword && <p className="text-xs text-red-600 mt-1.5">{errors.confirmPassword}</p>}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full px-6 py-3.5 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition-colors shadow-lg shadow-purple-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed mt-6"
          >
            {isLoading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-gray-300" />
          <span className="text-sm text-gray-500 font-medium">or</span>
          <div className="flex-1 h-px bg-gray-300" />
        </div>

        {/* Google Sign Up */}
        <button
          onClick={handleGoogleSignUp}
          className="w-full px-6 py-3.5 bg-white text-gray-700 border-2 border-gray-300 rounded-xl font-semibold hover:bg-gray-50 transition-colors active:scale-95 flex items-center justify-center gap-3"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Continue with Google
        </button>

        {/* Sign In Link */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Already have an account?{' '}
            <Link href="/auth/sign-in" className="text-purple-600 font-bold hover:text-purple-700 hover:underline">
              Sign in
            </Link>
          </p>
        </div>

        {/* Role switch removed — replaced by the inline role selector above the form */}
      </div>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gradient-to-br from-purple-500 via-purple-600 to-pink-500 flex items-center justify-center"><div className="animate-umshado-pulse"><UmshadoIcon size={48} /></div></div>}>
      <SignUpContent />
    </Suspense>
  );
}
