'use client';

import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    // Surface to console so Vercel logs capture it
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: '100svh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          background: 'var(--um-ivory)',
          textAlign: 'center',
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'rgba(154,33,67,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 20,
          }}>
            <svg width="28" height="28" fill="none" stroke="var(--um-crimson)" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--um-dark)', marginBottom: 8 }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: 14, color: 'var(--um-muted)', maxWidth: 320, lineHeight: 1.6, marginBottom: 28 }}>
            An unexpected error occurred. Please try refreshing the page.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '12px 28px', borderRadius: 12,
              background: 'linear-gradient(135deg,var(--um-crimson),var(--um-crimson-dark))',
              color: '#fff', fontSize: 14, fontWeight: 700,
              border: 'none', cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(154,33,67,0.3)',
            }}
          >
            Refresh page
          </button>
          {process.env.NODE_ENV === 'development' && (
            <pre style={{
              marginTop: 24, padding: 16, borderRadius: 8,
              background: 'var(--um-dark)', color: '#f5c6d0',
              fontSize: 11, textAlign: 'left', maxWidth: '90vw',
              overflowX: 'auto', whiteSpace: 'pre-wrap',
            }}>
              {this.state.error.message}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
