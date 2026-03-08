'use client';

import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useEffect, useState } from 'react';
import Link from 'next/link';

const ADMIN_EMAILS_RAW = process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? '';
const ADMIN_EMAILS = ADMIN_EMAILS_RAW.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

type VerStatus = 'payment_pending' | 'paid_pending_review' | 'approved' | 'rejected' | 'payment_failed';

interface VerRequest {
  id: string;
  vendor_id: string;
  status: VerStatus;
  paid_at: string | null;
  created_at: string;
  admin_notes: string | null;
  payfast_payment_id: string | null;
  vendor: {
    business_name: string;
    category: string;
    city: string;
    verified: boolean;
    verification_status: string;
  } | null;
}

const STATUS_STYLES: Record<VerStatus, string> = {
  payment_pending:    'bg-gray-100 text-gray-600',
  paid_pending_review:'bg-amber-100 text-amber-800',
  approved:           'bg-green-100 text-green-800',
  rejected:           'bg-red-100 text-red-800',
  payment_failed:     'bg-red-50 text-red-500',
};

const STATUS_LABELS: Record<VerStatus, string> = {
  payment_pending:    'Payment Pending',
  paid_pending_review:'Paid — Awaiting Review',
  approved:           'Approved ✓',
  rejected:           'Rejected',
  payment_failed:     'Payment Failed',
};

export default function AdminVerificationsPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [requests, setRequests] = useState<VerRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<'all' | VerStatus>('all');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email || !ADMIN_EMAILS.includes(user.email.toLowerCase())) {
        setAuthChecked(true);
        return;
      }
      setAuthed(true);
      setAuthChecked(true);
    })();
  }, []);

  useEffect(() => {
    if (!authed) return;
    loadRequests();
  }, [authed]);

  const loadRequests = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/admin/verifications', {
        headers: { Authorization: `Bearer ${session?.access_token || ''}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setRequests(data.requests || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    setActionLoading(id + action);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/admin/verifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify({ action, id, admin_notes: notes[id] || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action failed');
      await loadRequests();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setActionLoading(null);
    }
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600" />
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center max-w-sm">
          <p className="text-2xl mb-3">🔒</p>
          <p className="font-bold text-gray-900 mb-1">Admin only</p>
          <p className="text-sm text-gray-500 mb-4">You do not have permission to view this page.</p>
          <Link href="/" className="text-purple-600 text-sm font-medium">← Back to home</Link>
        </div>
      </div>
    );
  }

  const filtered = filter === 'all' ? requests : requests.filter(r => r.status === filter);
  const pendingCount = requests.filter(r => r.status === 'paid_pending_review').length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link href="/admin/beta-requests" className="text-sm text-gray-500 hover:text-gray-700">← Admin</Link>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Business Verifications</h1>
            <p className="text-sm text-gray-500 mt-0.5">Review vendor verification requests and award the ✓ badge</p>
          </div>
          {pendingCount > 0 && (
            <span className="bg-amber-500 text-white text-sm font-bold px-3 py-1.5 rounded-full">
              {pendingCount} pending
            </span>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-5 flex-wrap">
          {(['all', 'paid_pending_review', 'approved', 'rejected'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filter === f
                  ? 'bg-purple-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-purple-300'
              }`}
            >
              {f === 'all' ? 'All' : STATUS_LABELS[f as VerStatus]}
              {f === 'paid_pending_review' && pendingCount > 0 && ` (${pendingCount})`}
            </button>
          ))}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 mb-4">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
            <p className="text-3xl mb-3">🔵</p>
            <p className="font-semibold text-gray-700">No verification requests yet</p>
            <p className="text-sm text-gray-400 mt-1">They will appear here once vendors pay the fee.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(req => (
              <div
                key={req.id}
                className={`bg-white rounded-xl border-2 p-5 ${
                  req.status === 'paid_pending_review'
                    ? 'border-amber-300'
                    : req.status === 'approved'
                    ? 'border-green-300'
                    : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_STYLES[req.status]}`}>
                        {STATUS_LABELS[req.status]}
                      </span>
                      <p className="font-bold text-gray-900">{req.vendor?.business_name || 'Unknown Vendor'}</p>
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {req.vendor?.category} · {req.vendor?.city}
                    </p>
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <span className="text-xs text-gray-400">
                        Submitted {new Date(req.created_at).toLocaleDateString('en-ZA')}
                      </span>
                      {req.paid_at && (
                        <span className="text-xs text-gray-400">
                          Paid {new Date(req.paid_at).toLocaleDateString('en-ZA')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* View vendor link */}
                  <a
                    href={`/v/${req.vendor_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-purple-600 font-medium hover:text-purple-800 whitespace-nowrap"
                  >
                    View Profile ↗
                  </a>
                </div>

                {/* Admin notes */}
                {req.status === 'paid_pending_review' && (
                  <div className="mt-4 space-y-3">
                    <textarea
                      value={notes[req.id] || ''}
                      onChange={e => setNotes(prev => ({ ...prev, [req.id]: e.target.value }))}
                      placeholder="Add notes (optional — shown to vendor if rejected)"
                      rows={2}
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-purple-300"
                    />
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleAction(req.id, 'approve')}
                        disabled={actionLoading !== null}
                        className="flex-1 bg-green-600 text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-green-700 disabled:opacity-50 transition-colors"
                      >
                        {actionLoading === req.id + 'approve' ? 'Approving...' : '✓ Approve'}
                      </button>
                      <button
                        onClick={() => handleAction(req.id, 'reject')}
                        disabled={actionLoading !== null}
                        className="flex-1 bg-red-600 text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-red-700 disabled:opacity-50 transition-colors"
                      >
                        {actionLoading === req.id + 'reject' ? 'Rejecting...' : '✕ Reject'}
                      </button>
                    </div>
                  </div>
                )}

                {req.status === 'approved' && req.admin_notes && (
                  <p className="mt-3 text-xs text-gray-400 italic">Notes: {req.admin_notes}</p>
                )}

                {req.status === 'rejected' && (
                  <div className="mt-3 flex items-center justify-between">
                    {req.admin_notes && (
                      <p className="text-xs text-red-500 italic">Reason: {req.admin_notes}</p>
                    )}
                    <button
                      onClick={() => handleAction(req.id, 'approve')}
                      disabled={actionLoading !== null}
                      className="text-xs text-purple-600 font-medium hover:underline"
                    >
                      Approve anyway
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
