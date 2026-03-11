'use client';

/**
 * VerificationRequestCard
 * Drop this anywhere in the vendor dashboard.
 * Fetches and shows the current verification status, lets
 * vendors submit a request if they're not yet verified.
 *
 * Usage:
 *   import VerificationRequestCard from '@/components/VerificationRequestCard';
 *   ...
 *   <VerificationRequestCard vendorVerified={vendor?.verified ?? false} />
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface VerificationRequest {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  notes: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_CONFIG = {
  pending: {
    emoji: '⏳',
    label: 'Under Review',
    description: 'Your verification request has been submitted. We\'ll review it within 2–3 business days.',
    color: '#f59e0b',
    bg: '#fffbeb',
    border: '#fde68a',
  },
  approved: {
    emoji: '✅',
    label: 'Verified!',
    description: 'Your business has been verified. A verified badge now appears on your profile.',
    color: '#10b981',
    bg: '#ecfdf5',
    border: '#a7f3d0',
  },
  rejected: {
    emoji: '❌',
    label: 'Not Approved',
    description: 'Your request wasn\'t approved this time. Review the feedback and resubmit.',
    color: '#ef4444',
    bg: '#fef2f2',
    border: '#fecaca',
  },
};

export default function VerificationRequestCard({ vendorVerified }: { vendorVerified: boolean }) {
  const [request, setRequest] = useState<VerificationRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadRequest();
  }, []);

  const loadRequest = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/vendor/verification-request', {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      if (res.ok) {
        const json = await res.json();
        setRequest(json.request);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/vendor/verification-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ notes }),
      });
      if (res.ok) {
        const json = await res.json();
        setRequest(json.request);
        setSubmitted(true);
        setShowForm(false);
        setNotes('');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Already verified — show badge and no action needed
  if (vendorVerified) {
    return (
      <div style={{
        padding: '14px 16px', borderRadius: 16,
        background: '#ecfdf5', border: '1.5px solid #a7f3d0',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="18" height="18" fill="none" stroke="#fff" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#065f46' }}>uMshado Verified</p>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: '#6ee7b7' }}>Your profile shows a verified badge to all couples</p>
        </div>
      </div>
    );
  }

  if (loading) return null;

  return (
    <div style={{ borderRadius: 16, border: '1.5px solid #f1f0ee', background: '#fff', overflow: 'hidden' }}>
      {/* Card header */}
      <div style={{
        padding: '14px 16px',
        background: 'linear-gradient(135deg, #0f0c29, #302b63)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(184,151,62,0.2)', border: '1.5px solid rgba(184,151,62,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: 18 }}>🛡️</span>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#fff' }}>Get Verified</p>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>Build trust with couples — show a verified badge</p>
        </div>
      </div>

      <div style={{ padding: '16px' }}>
        {/* Current request status */}
        {request && (() => {
          const cfg = STATUS_CONFIG[request.status];
          return (
            <div style={{ padding: '12px 14px', borderRadius: 12, background: cfg.bg, border: `1.5px solid ${cfg.border}`, marginBottom: showForm ? 14 : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 18 }}>{cfg.emoji}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: cfg.color }}>{cfg.label}</span>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: '#374151', lineHeight: 1.5 }}>{cfg.description}</p>
              {request.admin_notes && (
                <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, background: 'rgba(0,0,0,0.04)', fontSize: 11, color: '#6b7280' }}>
                  <strong>Feedback:</strong> {request.admin_notes}
                </div>
              )}
              {request.status === 'rejected' && !showForm && (
                <button onClick={() => setShowForm(true)}
                  style={{ marginTop: 10, padding: '7px 14px', borderRadius: 8, background: '#fff', border: '1.5px solid #e5e7eb', fontSize: 12, fontWeight: 600, color: '#374151', cursor: 'pointer' }}>
                  Resubmit Request
                </button>
              )}
              {request.status === 'pending' && (
                <p style={{ margin: '8px 0 0', fontSize: 10, color: '#9ca3af' }}>
                  Submitted {new Date(request.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              )}
            </div>
          );
        })()}

        {/* No request yet — show CTA */}
        {!request && !showForm && (
          <div>
            <p style={{ margin: '0 0 10px', fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>
              Verified vendors get a blue badge, appear higher in search results, and build more trust with couples.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              {['✅ Verified badge on profile', '⬆️ Higher search ranking', '💬 More couple inquiries'].map(b => (
                <span key={b} style={{ fontSize: 10, padding: '3px 9px', borderRadius: 20, background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', fontWeight: 600 }}>{b}</span>
              ))}
            </div>
            <button onClick={() => setShowForm(true)}
              style={{
                width: '100%', height: 44, borderRadius: 12, border: 'none',
                background: 'linear-gradient(135deg,#0f0c29,#302b63)',
                color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(15,12,41,0.25)',
              }}>
              Request Verification 🛡️
            </button>
          </div>
        )}

        {/* Form */}
        {showForm && (
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
              Tell us about your business (optional)
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="e.g. I've been in the industry for 5 years, have CIPC registration, can provide references…"
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '10px 12px', borderRadius: 12,
                border: '1.5px solid #e5e7eb', fontSize: 13, color: '#111827',
                resize: 'none', outline: 'none', fontFamily: 'inherit',
                marginBottom: 12,
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setShowForm(false); setNotes(''); }}
                style={{ flex: 1, height: 44, borderRadius: 12, border: '1.5px solid #e5e7eb', background: '#fff', color: '#374151', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleSubmit} disabled={submitting}
                style={{
                  flex: 2, height: 44, borderRadius: 12, border: 'none',
                  background: 'linear-gradient(135deg,#0f0c29,#302b63)',
                  color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                  opacity: submitting ? 0.7 : 1,
                }}>
                {submitting ? 'Submitting…' : 'Submit Request'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
