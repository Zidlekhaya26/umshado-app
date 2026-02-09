'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { UmshadoLogo } from '@/components/ui/UmshadoLogo';

export default function RequestAccess() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [roleInterest, setRoleInterest] = useState<'couple' | 'vendor'>('couple');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim() || !email.trim()) {
      setError('Please fill in all fields.');
      return;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error: insertError } = await supabase
        .from('beta_requests')
        .insert({ name: name.trim(), email: email.trim().toLowerCase(), role_interest: roleInterest });

      if (insertError) {
        // Unique constraint means they already requested
        if (insertError.code === '23505') {
          setSubmitted(true);
          return;
        }
        console.error('Beta request error:', insertError);
        setError('Something went wrong. Please try again.');
        return;
      }

      setSubmitted(true);
    } catch (err) {
      console.error('Beta request error:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-500 via-purple-600 to-pink-500 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 text-center">
          {/* Success icon */}
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-3">Request Received!</h1>
          <p className="text-sm text-gray-600 mb-6 leading-relaxed">
            Thanks for your interest in uMshado. We&apos;ll review your request and
            send an invite to <span className="font-semibold text-gray-900">{email}</span> when
            a spot opens up.
          </p>

          <Link
            href="/auth/sign-in"
            className="inline-block px-6 py-3 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 transition-colors active:scale-95"
          >
            Already have an invite? Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-500 via-purple-600 to-pink-500 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/auth" className="inline-block mb-4">
            <UmshadoLogo iconSize={48} />
          </Link>

          {/* Beta badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-bold mb-4">
            <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
            PRIVATE BETA
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">Request Early Access</h1>
          <p className="text-sm text-gray-600 leading-relaxed">
            uMshado is currently in private beta. Fill in your details below and
            we&apos;ll send you an invite when a spot opens up.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-semibold text-gray-700 mb-1.5">
              Full Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors text-base"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-1.5">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors text-base"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              I&apos;m interested as a…
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRoleInterest('couple')}
                className={`px-4 py-3 rounded-xl border-2 font-semibold text-sm text-center transition-all ${
                  roleInterest === 'couple'
                    ? 'border-purple-600 bg-purple-50 text-purple-700'
                    : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
                }`}
              >
                💍 Couple
              </button>
              <button
                type="button"
                onClick={() => setRoleInterest('vendor')}
                className={`px-4 py-3 rounded-xl border-2 font-semibold text-sm text-center transition-all ${
                  roleInterest === 'vendor'
                    ? 'border-purple-600 bg-purple-50 text-purple-700'
                    : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
                }`}
              >
                🏢 Vendor
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full px-6 py-3.5 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition-colors shadow-lg shadow-purple-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {isSubmitting ? 'Submitting…' : 'Request Access'}
          </button>
        </form>

        {/* Sign in link */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Already have an invite?{' '}
            <Link href="/auth/sign-in" className="text-purple-600 font-bold hover:text-purple-700 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
