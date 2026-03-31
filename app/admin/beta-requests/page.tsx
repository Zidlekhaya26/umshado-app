'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import PageShell from '@/components/ui/PageShell';
import SectionTitle from '@/components/ui/SectionTitle';
import { Input } from '@/components/ui/Input';
import Chip from '@/components/ui/Chip';
import { Card, CardContent } from '@/components/ui/Card';

// ─── Types ───────────────────────────────────────────────

type StatusValue = 'pending' | 'approved' | 'redeemed' | 'revoked' | 'rejected';

interface BetaRequest {
  id: string;
  name: string;
  email: string;
  role_interest: string;
  status: StatusValue;
  invite_token: string | null;
  created_at: string;
  registered: boolean;
}

type FilterTab = 'all' | StatusValue;

// Admin check is done server-side via /api/admin/is-admin
// so admin email addresses are never exposed in the client bundle.

// ─── Status helpers ──────────────────────────────────────

const STATUS_COLORS: Record<StatusValue, string> = {
  pending:  'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-800',
  redeemed: 'bg-blue-100 text-blue-800',
  revoked:  'bg-red-100 text-red-800',
  rejected: 'bg-gray-200 text-gray-700',
};

const FILTER_TABS: { label: string; value: FilterTab }[] = [
  { label: 'All',      value: 'all' },
  { label: 'Pending',  value: 'pending' },
  { label: 'Approved', value: 'approved' },
  { label: 'Redeemed', value: 'redeemed' },
  { label: 'Revoked',  value: 'revoked' },
];

// ─── Component ───────────────────────────────────────────

export default function AdminBetaRequestsPage() {
  const router = useRouter();

  // Auth state
  const [authed, setAuthed] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [notAuthorized, setNotAuthorized] = useState(false);

  // Data
  const [requests, setRequests] = useState<BetaRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [schemaError, setSchemaError] = useState(false);

  // Filters
  const [filter, setFilter] = useState<FilterTab>('all');
  const [search, setSearch] = useState('');

  // Action in-progress tracker
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Clipboard / toast
  const [toast, setToast] = useState<string | null>(null);

  // ── Auth gate ──────────────────────────────────────────

  useEffect(() => {
    (async () => {
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (!user) {
        // Not logged in at all — redirect to sign-in
        router.replace('/auth/sign-in');
        return;
      }

      // Check admin status server-side (keeps admin emails out of the client bundle)
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
        const res = await fetch('/api/admin/is-admin', { headers });
        if (res.ok) {
          const { isAdmin } = await res.json();
          if (isAdmin) {
            setAuthed(true);
            setAuthChecked(true);
            return;
          }
        }
      } catch {}

      // Not an admin
      setNotAuthorized(true);
      setAuthChecked(true);
    })();
  }, [router]);

  // ── Helper: get access token for API calls ─────────────

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      return { Authorization: `Bearer ${session.access_token}` };
    }
    return {};
  }, []);

  // ── Fetch data ─────────────────────────────────────────

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSchemaError(false);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/admin/beta-requests', { headers });
      const data = await res.json();
      if (!res.ok) {
        if (data.schemaError) {
          setSchemaError(true);
          setError(data.error);
        } else if (res.status === 403) {
          setError('Not authorized. Your email is not in the admin allowlist.');
        } else {
          setError(data.error || 'Failed to load beta requests.');
        }
        return;
      }
      setRequests(data.requests ?? []);
    } catch {
      setError('Network error — could not reach the server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authed) fetchRequests();
  }, [authed, fetchRequests]);

  // ── Actions ────────────────────────────────────────────

  const performAction = async (id: string, action: string) => {
    setActionLoading(id);
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch('/api/admin/beta-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ action, id }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(`Error: ${data.error}`);
        return;
      }
      // Update locally
      setRequests(prev =>
        prev.map(r => (r.id === id ? { ...r, status: data.updated?.status ?? r.status } : r)),
      );
      showToast(`Status → ${data.updated?.status}`);
    } catch {
      showToast('Network error');
    } finally {
      setActionLoading(null);
    }
  };

  // ── Clipboard helpers ──────────────────────────────────

  const copyInviteLink = (token: string) => {
    const link = `${window.location.origin}/auth/sign-up?invite=${token}`;
    navigator.clipboard.writeText(link).then(() => showToast('Invite link copied!')).catch(() => showToast('Copy failed'));
  };

  const copyResendMessage = (req: BetaRequest) => {
    const link = `${window.location.origin}/auth/sign-up?invite=${req.invite_token}`;
    const msg = [
      `Hi ${req.name || 'there'},`,
      '',
      `Great news — you've been invited to join uMshado! 🎉`,
      '',
      `Click the link below to create your account:`,
      link,
      '',
      `You'll be signing up as a ${req.role_interest}. If you already created an account, just sign in at:`,
      `${window.location.origin}/auth/sign-in`,
      '',
      `— The uMshado Team`,
    ].join('\n');
    navigator.clipboard.writeText(msg).then(() => showToast('Invite message copied!')).catch(() => showToast('Copy failed'));
  };

  // ── Toast ──────────────────────────────────────────────

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // ── Filtered data ──────────────────────────────────────

  const filtered = useMemo(() => {
    let list = requests;
    if (filter !== 'all') list = list.filter(r => r.status === filter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        r => r.email.toLowerCase().includes(q) || r.name.toLowerCase().includes(q),
      );
    }
    return list;
  }, [requests, filter, search]);

  // ── Counts per status ──────────────────────────────────

  const counts = useMemo(() => {
    const m: Record<string, number> = { all: requests.length };
    for (const r of requests) m[r.status] = (m[r.status] || 0) + 1;
    return m;
  }, [requests]);

  // ── Render ─────────────────────────────────────────────

  if (!authChecked) {
    return (
      <PageShell maxWidth="max-w-2xl">
        <div className="flex items-center justify-center py-20">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </PageShell>
    );
  }

  if (notAuthorized) {
    return (
      <PageShell maxWidth="max-w-md">
        <Card>
          <CardContent className="py-10 text-center">
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-12.728 12.728M5.636 5.636l12.728 12.728" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">Not Authorized</h2>
            <p className="text-sm text-gray-600 mb-6">
              Your account does not have admin access. This page is restricted to allowlisted emails.
            </p>
            <button
              onClick={() => router.push('/')}
              className="px-6 py-2.5 rounded-full bg-primary text-primary-foreground font-semibold text-sm hover:brightness-110 transition-colors"
            >
              Go Home
            </button>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell maxWidth="max-w-3xl">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-foreground text-white px-5 py-3 rounded-2xl shadow-lg text-sm font-medium animate-fade-in">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <SectionTitle
          title="Beta Requests"
          subtitle={`Manage private beta invitations · ${requests.length} total`}
        />
        <div className="flex gap-3 mt-3 flex-wrap">
          <a href="/admin/beta-requests"
            className="px-3 py-1.5 rounded-full text-xs font-semibold bg-purple-600 text-white">
            Beta Requests
          </a>
          <a href="/admin/verifications"
            className="px-3 py-1.5 rounded-full text-xs font-semibold bg-white border border-gray-200 text-gray-600 hover:border-purple-300 hover:text-purple-700 transition-colors">
            🔵 Verifications
          </a>
        </div>
      </div>

      {/* Schema error callout */}
      {schemaError && (
        <Card className="mb-6 border-red-300 bg-red-50">
          <CardContent className="py-5">
            <h3 className="font-bold text-red-800 mb-1">⚠️ Database Schema Issue</h3>
            <p className="text-sm text-red-700 mb-3">{error}</p>
            <div className="bg-white rounded-xl p-4 text-xs font-mono text-gray-800 border border-red-200 overflow-x-auto">
              <p className="text-gray-500 mb-1">-- Run in Supabase SQL editor:</p>
              <p>{'ALTER TABLE public.beta_requests'}</p>
              <p>{'  ADD COLUMN IF NOT EXISTS invite_token uuid DEFAULT gen_random_uuid(),'}</p>
              <p>{'  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT \'pending\''}</p>
              <p>{'    CHECK (status IN (\'pending\', \'approved\', \'redeemed\', \'rejected\', \'revoked\'));'}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generic error */}
      {error && !schemaError && (
        <Card className="mb-6 border-red-300 bg-red-50">
          <CardContent className="py-5">
            <p className="text-sm text-red-700">{error}</p>
            <button
              onClick={fetchRequests}
              className="mt-3 text-sm font-semibold text-primary hover:underline"
            >
              Retry
            </button>
          </CardContent>
        </Card>
      )}

      {/* Search + Filters */}
      {!schemaError && (
        <>
          <div className="mb-4">
            <Input
              placeholder="Search by name or email…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-2 mb-6">
            {FILTER_TABS.map(tab => (
              <Chip
                key={tab.value}
                selected={filter === tab.value}
                onClick={() => setFilter(tab.value)}
              >
                {tab.label}
                <span className="ml-1 opacity-90">({counts[tab.value] ?? 0})</span>
              </Chip>
            ))}
          </div>
        </>
      )}

      {/* Loading */}
      {loading && !schemaError && (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && filtered.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-gray-600 text-sm">
              {search ? 'No requests match your search.' : 'No beta requests yet.'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Request cards */}
      {!loading && !error && filtered.length > 0 && (
        <div className="space-y-4">
          {filtered.map(req => (
            <RequestCard
              key={req.id}
              req={req}
              actionLoading={actionLoading}
              onAction={performAction}
              onCopyLink={copyInviteLink}
              onCopyMessage={copyResendMessage}
            />
          ))}
        </div>
      )}

      {/* Footer info */}
      <div className="mt-8 text-center">
        <p className="text-xs text-gray-600">
          Admin access restricted to allowlisted emails via NEXT_PUBLIC_ADMIN_EMAILS.
        </p>
      </div>
    </PageShell>
  );
}

// ─── Request Card ────────────────────────────────────────

function RequestCard({
  req,
  actionLoading,
  onAction,
  onCopyLink,
  onCopyMessage,
}: {
  req: BetaRequest;
  actionLoading: string | null;
  onAction: (id: string, action: string) => void;
  onCopyLink: (token: string) => void;
  onCopyMessage: (req: BetaRequest) => void;
}) {
  const busy = actionLoading === req.id;
  const created = new Date(req.created_at).toLocaleDateString('en-ZA', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  return (
    <Card className={`transition-opacity ${busy ? 'opacity-60 pointer-events-none' : ''}`}>
      <CardContent className="py-5">
        {/* Top row: name + status */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <h3 className="font-bold text-foreground truncate">{req.name || '(no name)'}</h3>
            <p className="text-sm text-gray-600 truncate">{req.email}</p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Role chip */}
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-purple-100 text-purple-800 capitalize">
              {req.role_interest}
            </span>

            {/* Status chip */}
            <span
              className={`text-xs font-bold px-2.5 py-1 rounded-full capitalize ${STATUS_COLORS[req.status] || 'bg-gray-100 text-gray-600'}`}
            >
              {req.status}
            </span>
          </div>
        </div>

        {/* Registration badge */}
        <div className="mb-3">
          {req.registered ? (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2">
              <svg className="w-4 h-4 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-xs text-blue-800">
                <span className="font-semibold">Already registered.</span>{' '}
                This email has an account — they should <span className="font-semibold">Sign In</span> (no invite needed).
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              <svg className="w-4 h-4 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z" />
              </svg>
              <p className="text-xs text-amber-800">
                <span className="font-semibold">Not registered.</span>{' '}
                {req.status === 'approved'
                  ? 'Send them the invite link to sign up.'
                  : 'Approve this request to generate an invite link.'}
              </p>
            </div>
          )}
        </div>

        {/* Meta row */}
        <p className="text-xs text-gray-600 mb-4">
          Requested {created}
          {req.invite_token && (
            <> · Token: <span className="font-mono">{req.invite_token.slice(0, 8)}…</span></>
          )}
        </p>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          {/* Approve */}
          {(req.status === 'pending' || req.status === 'revoked' || req.status === 'rejected') && (
            <button
              onClick={() => onAction(req.id, 'approve')}
              className="px-4 py-2 text-xs font-semibold rounded-full bg-green-600 text-white hover:bg-green-700 transition-colors active:scale-95"
            >
              ✓ Approve
            </button>
          )}

          {/* Revoke */}
          {(req.status === 'approved' || req.status === 'pending') && (
            <button
              onClick={() => onAction(req.id, 'revoke')}
              className="px-4 py-2 text-xs font-semibold rounded-full bg-red-100 text-red-700 hover:bg-red-200 transition-colors active:scale-95"
            >
              ✕ Revoke
            </button>
          )}

          {/* Reset to pending */}
          {(req.status === 'approved' || req.status === 'revoked' || req.status === 'rejected') && (
            <button
              onClick={() => onAction(req.id, 'pending')}
              className="px-4 py-2 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors active:scale-95"
            >
              ↺ Pending
            </button>
          )}

          {/* Copy invite link — only when approved and has token */}
          {req.invite_token && req.status === 'approved' && (
            <button
              onClick={() => onCopyLink(req.invite_token!)}
              className="px-4 py-2 text-xs font-semibold rounded-full bg-secondary text-primary hover:brightness-105 transition-colors active:scale-95"
            >
              📋 Copy Invite Link
            </button>
          )}

          {/* Resend instructions — only when approved and has token */}
          {req.invite_token && req.status === 'approved' && (
            <button
              onClick={() => onCopyMessage(req)}
              className="px-4 py-2 text-xs font-semibold rounded-full border border-border text-gray-700 bg-white hover:bg-gray-50 transition-colors active:scale-95"
            >
              ✉️ Copy Invite Message
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
