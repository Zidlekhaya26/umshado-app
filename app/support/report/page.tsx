'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import BottomNav from '@/components/BottomNav';

const ISSUE_TYPES = [
  { value: 'bug', label: 'Bug — Something is broken' },
  { value: 'ui', label: 'UI — Visual / layout issue' },
  { value: 'performance', label: 'Performance — Slow or unresponsive' },
  { value: 'other', label: 'Other' },
] as const;

export default function ReportProblemPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [pageRoute, setPageRoute] = useState('');
  const [issueType, setIssueType] = useState<string>('bug');
  const [description, setDescription] = useState('');
  const [stepsToReproduce, setStepsToReproduce] = useState('');
  const [expectedResult, setExpectedResult] = useState('');
  const [actualResult, setActualResult] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reportId, setReportId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Auto-detect: set referrer route if available
    if (typeof document !== 'undefined' && document.referrer) {
      try {
        const url = new URL(document.referrer);
        setPageRoute(url.pathname);
      } catch {
        // ignore
      }
    }

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    })();
  }, []);

  const handleSubmit = async () => {
    if (!description.trim()) {
      setError('Please describe the problem.');
      return;
    }
    if (!userId) {
      setError('You must be signed in to report a problem.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const { data, error: insertError } = await supabase
      .from('bug_reports')
      .insert({
        user_id: userId,
        page_route: pageRoute.trim() || null,
        issue_type: issueType,
        description: description.trim(),
        steps_to_reproduce: stepsToReproduce.trim() || null,
        expected_result: expectedResult.trim() || null,
        actual_result: actualResult.trim() || null,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Failed to submit bug report:', insertError);
      setError('Failed to submit. Please try again.');
      setSubmitting(false);
      return;
    }

    setReportId(data.id);
    setSubmitting(false);
  };

  // ── Success state ──────────────────────────────────────
  if (reportId) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="w-full max-w-screen-xl mx-auto min-h-screen flex flex-col pb-24 px-4">
          <div className="bg-white border-b border-gray-200 px-4 py-5">
            <div className="flex items-center gap-3">
              <Link href="/settings" className="p-1 -ml-1 rounded-full hover:bg-gray-100 transition-colors">
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <h1 className="text-xl font-bold text-gray-900">Report a Problem</h1>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center px-4">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-2">Report Submitted!</h2>
              <p className="text-sm text-gray-600 mb-2">Thank you for helping us improve uMshado.</p>
              <div className="bg-gray-50 rounded-xl border-2 border-gray-200 px-4 py-3 mb-6">
                <p className="text-xs text-gray-500">Report Reference</p>
                <p className="text-sm font-mono font-bold text-purple-600 mt-1">{reportId.slice(0, 8).toUpperCase()}</p>
              </div>
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

  // ── Form ───────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto w-full max-w-md lg:max-w-6xl lg:px-6 min-h-screen bg-white shadow-lg flex flex-col pb-24">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-4 py-5">
          <div className="flex items-center gap-3">
            <Link href="/settings" className="p-1 -ml-1 rounded-full hover:bg-gray-100 transition-colors">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Report a Problem</h1>
              <p className="text-sm text-gray-600 mt-0.5">Help us squash bugs 🐛</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
          {error && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm font-semibold text-red-700">
              {error}
            </div>
          )}

          {/* Page / Route */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Page / Route</label>
            <input type="text" value={pageRoute} onChange={e => setPageRoute(e.target.value)} placeholder="e.g., /couple/planner" className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm text-gray-900" />
            <p className="text-xs text-gray-500 mt-1">Auto-detected if you came from another page</p>
          </div>

          {/* Issue Type */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Issue Type <span className="text-red-500">*</span></label>
            <select
              value={issueType}
              onChange={e => setIssueType(e.target.value)}
              className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm text-gray-900 bg-white"
            >
              {ISSUE_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Description <span className="text-red-500">*</span></label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} placeholder="What went wrong?" className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm text-gray-900 resize-none" />
          </div>

          {/* Steps to Reproduce */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Steps to Reproduce</label>
            <textarea value={stepsToReproduce} onChange={e => setStepsToReproduce(e.target.value)} rows={3} placeholder="1. Go to…&#10;2. Tap on…&#10;3. See error" className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm text-gray-900 resize-none" />
          </div>

          {/* Expected vs Actual */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Expected</label>
              <textarea value={expectedResult} onChange={e => setExpectedResult(e.target.value)} rows={2} placeholder="What should happen" className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm text-gray-900 resize-none" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Actual</label>
              <textarea value={actualResult} onChange={e => setActualResult(e.target.value)} rows={2} placeholder="What actually happened" className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm text-gray-900 resize-none" />
            </div>
          </div>

          {/* Screenshot placeholder */}
          <div className="bg-gray-50 rounded-xl border-2 border-dashed border-gray-300 p-4 text-center">
            <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-2">
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-xs font-semibold text-gray-600">Screenshot upload coming in Phase 2</p>
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full px-4 py-3 bg-purple-600 text-white rounded-xl font-semibold text-base hover:bg-purple-700 transition-colors shadow-md disabled:opacity-60"
          >
            {submitting ? 'Submitting…' : 'Submit Report'}
          </button>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
