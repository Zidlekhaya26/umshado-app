'use client';

import Link from 'next/link';
import { BETA_INVITE_ONLY } from '@/lib/betaGate';
import { UmshadoLogo } from '@/components/ui/UmshadoLogo';

export default function AuthLanding() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-500 via-purple-600 to-pink-500 flex items-center justify-center p-4">
      {/* Mobile-first container wrapper */}
      <div className="mx-auto w-full max-w-md lg:max-w-6xl lg:px-6 bg-white rounded-2xl shadow-2xl p-8">
        {/* Logo/Icon */}
        <div className="text-center mb-8">
          <div className="animate-umshado-in mb-4">
            <UmshadoLogo iconSize={56} />
          </div>

          {/* Beta Badge */}
          {BETA_INVITE_ONLY && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-bold mb-4">
              <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
              PRIVATE BETA
            </div>
          )}

          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to uMshado</h1>
          <p className="text-base text-gray-600">
            {BETA_INVITE_ONLY
              ? 'Your all-in-one South African wedding planning platform — currently in private beta.'
              : 'Your all-in-one South African wedding planning platform'}
          </p>
        </div>

        {/* Invite Required Banner */}
        {BETA_INVITE_ONLY && (
          <div className="bg-purple-50 border border-purple-200 rounded-xl px-4 py-3.5 mb-6">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-purple-900">Invite Required</p>
                <p className="text-xs text-purple-700 mt-0.5">
                  New sign-ups are by invitation only. If you already have an invite, sign in below.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Features List */}
        <div className="space-y-3 mb-8">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm text-gray-700">
              <span className="font-semibold">For Couples:</span> Plan your dream wedding with ease
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm text-gray-700">
              <span className="font-semibold">For Vendors:</span> Showcase your services and grow your business
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm text-gray-700">
              <span className="font-semibold">Live Features:</span> Share your special moments with loved ones
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <Link
            href="/auth/sign-in"
            className="block w-full px-6 py-3.5 bg-purple-600 text-white rounded-xl font-bold text-center hover:bg-purple-700 transition-colors shadow-lg shadow-purple-200 active:scale-95"
          >
            Sign In
          </Link>

          {BETA_INVITE_ONLY ? (
            <Link
              href="/request-access"
              className="block w-full px-6 py-3.5 bg-white text-purple-600 border-2 border-purple-600 rounded-xl font-bold text-center hover:bg-purple-50 transition-colors active:scale-95"
            >
              Request Access
            </Link>
          ) : (
            <Link
              href="/auth/sign-up"
              className="block w-full px-6 py-3.5 bg-white text-purple-600 border-2 border-purple-600 rounded-xl font-bold text-center hover:bg-purple-50 transition-colors active:scale-95"
            >
              Create Account
            </Link>
          )}
        </div>

        {/* Helper Text */}
        <div className="mt-6 p-4 bg-purple-50 rounded-xl border border-purple-100">
          <p className="text-xs text-center text-gray-700 leading-relaxed">
            {BETA_INVITE_ONLY ? (
              <>
                <span className="font-semibold">Private Beta.</span>{' '}
                We&apos;re onboarding vendors and couples in waves. Request access and
                we&apos;ll send you an invite when a spot opens up.
              </>
            ) : (
              <>
                <span className="font-semibold">One account for all.</span> Couples and vendors both use the same account. 
                You&apos;ll choose your role after signing up.
              </>
            )}
          </p>
        </div>

        {/* Additional Info */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            By continuing, you agree to our{' '}
            <button className="text-purple-600 font-semibold hover:underline">Terms</button>
            {' '}and{' '}
            <button className="text-purple-600 font-semibold hover:underline">Privacy Policy</button>
          </p>
        </div>
      </div>
    </div>
  );
}
