'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { UmshadoIcon } from '@/components/ui/UmshadoLogo';
import BottomNav from '@/components/BottomNav';

export default function ContactSupportPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [role, setRole] = useState<'couple' | 'vendor' | 'other'>('couple');
  const [includeDiagnostics, setIncludeDiagnostics] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill from auth
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        setEmail(user.email ?? '');
        const fullName =
          (user.user_metadata as Record<string, string> | undefined)?.full_name
          || (user.user_metadata as Record<string, string> | undefined)?.name
          || '';
        setName(fullName);

        // Get active role
        const { data: profile } = await supabase
          .from('profiles')
          .select('active_role, full_name')
          .eq('id', user.id)
          .maybeSingle();
        if (profile?.active_role) setRole(profile.active_role as 'couple' | 'vendor');
        if (profile?.full_name) setName(profile.full_name);
      }
    })();
  }, []);

  const handleSubmit = async () => {
    if (!name.trim() || !email.trim() || !subject.trim() || !message.trim()) {
      setError('Please fill in all required fields.');
      return;
    }
    if (!userId) {
      setError('You must be signed in to submit a ticket.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const { data, error: insertError } = await supabase
      .from('support_tickets')
      .insert({
        user_id: userId,
        name: name.trim(),
        email: email.trim(),
        subject: subject.trim(),
        message: message.trim(),
        role,
        include_diagnostics: includeDiagnostics,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Failed to submit support ticket:', insertError);
      setError('Failed to submit. Please try again or email us directly.');
      setSubmitting(false);
      return;
    }

    setTicketId(data.id);
    setSubmitting(false);
  };

  const mailtoLink = `mailto:support@umshado.co.za?subject=${encodeURIComponent(subject || 'Support Request')}`;

  // ── Success state ──────────────────────────────────────
  if (ticketId) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="w-full max-w-screen-xl mx-auto min-h-screen bg-white shadow-lg flex flex-col pb-24 px-4">
          <div className="bg-white border-b border-gray-200 px-4 py-5">
            <div className="flex items-center gap-3">
              <Link href="/settings" className="p-1 -ml-1 rounded-full hover:bg-gray-100 transition-colors">
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <h1 className="text-xl font-bold text-gray-900">Contact Support</h1>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center px-4">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-2">Ticket Submitted!</h2>
              <p className="text-sm text-gray-600 mb-2">We&apos;ve received your support request.</p>
              <div className="bg-gray-50 rounded-xl border-2 border-gray-200 px-4 py-3 mb-6">
                <p className="text-xs text-gray-500">Ticket Reference</p>
                <p className="text-sm font-mono font-bold text-purple-600 mt-1">{ticketId.slice(0, 8).toUpperCase()}</p>
              </div>
              <p className="text-xs text-gray-500 mb-6">We&apos;ll get back to you as soon as possible.</p>
              <Link
                href="/settings"
                className="inline-block px-6 py-3 bg-purple-600 text-white rounded-xl font-semibold text-sm hover:bg-purple-700 transition-colors shadow-md"
              >
                Back to Settings
              </Link>
            </div>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  // ── Form state ─────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto min-h-screen bg-white shadow-lg flex flex-col pb-24">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-4 py-5">
          <div className="flex items-center gap-3">
            <Link href="/settings" className="p-1 -ml-1 rounded-full hover:bg-gray-100 transition-colors">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Contact Support</h1>
              <p className="text-sm text-gray-600 mt-0.5">We&apos;re here to help</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
          {error && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm font-semibold text-red-700">
              {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Name <span className="text-red-500">*</span></label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your full name" className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm text-gray-900" />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email <span className="text-red-500">*</span></label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm text-gray-900" />
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">I am a…</label>
            <div className="flex gap-2">
              {(['couple', 'vendor', 'other'] as const).map(r => (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  className={`flex-1 px-3 py-2 rounded-xl text-sm font-semibold transition-all capitalize ${
                    role === r ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Subject <span className="text-red-500">*</span></label>
            <input type="text" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Brief description of your issue" className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm text-gray-900" />
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Message <span className="text-red-500">*</span></label>
            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={5} placeholder="Tell us more about what you need help with…" className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm text-gray-900 resize-none" />
          </div>

          {/* Diagnostics */}
          <div className="flex items-start gap-3 bg-gray-50 rounded-xl p-3 border border-gray-200">
            <input
              type="checkbox"
              id="diagnostics"
              checked={includeDiagnostics}
              onChange={e => setIncludeDiagnostics(e.target.checked)}
              className="mt-0.5 w-5 h-5 rounded border-2 border-gray-300 text-purple-600 focus:ring-2 focus:ring-purple-500"
            />
            <label htmlFor="diagnostics" className="text-xs text-gray-600 leading-relaxed">
              <span className="font-semibold text-gray-900">Include diagnostic info</span>
              <br />
              Share your browser, device, and app version to help us debug faster.
            </label>
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full px-4 py-3 bg-purple-600 text-white rounded-xl font-semibold text-base hover:bg-purple-700 transition-colors shadow-md disabled:opacity-60"
          >
            {submitting ? 'Submitting…' : 'Submit Ticket'}
          </button>

          {/* Email fallback */}
          <div className="text-center pt-2">
            <p className="text-xs text-gray-500 mb-2">Or reach us directly:</p>
            <a
              href={mailtoLink}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Email support@umshado.co.za
            </a>
          </div>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
