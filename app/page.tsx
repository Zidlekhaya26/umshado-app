'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthRole } from '@/app/providers/AuthRoleProvider';
import { BETA_INVITE_ONLY } from '@/lib/betaGate';

// Crimson Design System v4
const CR = '#9A2143';    // Primary crimson
const CR2 = '#731832';   // Dark crimson
const GD = '#BD983F';    // Gold accent
const GD2 = '#8a6010';   // Dark gold
const BG = '#faf8f5';    // Warm ivory background
const DK = '#1a0d12';    // Dark text

export default function Home() {
  const { user, role, loading } = useAuthRole();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (user && role === 'couple') { router.replace('/couple/dashboard'); return; }
    if (user && role === 'vendor') { router.replace('/vendor/dashboard'); return; }
    // user logged in but no role yet (onboarding incomplete) — let them stay
  }, [user, role, loading, router]);

  return (
    <div style={{ 
      minHeight: '100svh', 
      background: BG, 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      padding: 16,
      fontFamily: "'DM Sans', system-ui, sans-serif"
    }}>
      <div style={{ 
        width: '100%', 
        maxWidth: 420, 
        background: '#fff', 
        borderRadius: 24, 
        boxShadow: '0 8px 48px rgba(154,33,67,0.15)', 
        padding: '44px 32px 40px', 
        position: 'relative', 
        overflow: 'hidden' 
      }}>
        {/* Crimson subtle decoration orbs */}
        <div style={{ 
          position: 'absolute', 
          top: -50, 
          right: -50, 
          width: 160, 
          height: 160, 
          borderRadius: '50%', 
          background: 'rgba(154,33,67,0.04)', 
          pointerEvents: 'none' 
        }} />
        <div style={{ 
          position: 'absolute', 
          bottom: -30, 
          left: -30, 
          width: 100, 
          height: 100, 
          borderRadius: '50%', 
          background: 'rgba(189,152,63,0.06)', 
          pointerEvents: 'none' 
        }} />

        {/* Logo & Content */}
        <div style={{ textAlign: 'center', marginBottom: 32, position: 'relative' }}>
          {/* Logo */}
          <div style={{ display: 'inline-block', marginBottom: 20 }}>
            <Image
              src="/logo-full.png"
              alt="uMshado"
              width={160}
              height={52}
              style={{ height: 52, width: 'auto', objectFit: 'contain' }}
            />
          </div>

          {BETA_INVITE_ONLY && (
            <div style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: 6, 
              padding: '5px 14px', 
              borderRadius: 20, 
              background: 'rgba(154,33,67,0.08)', 
              border: `1.5px solid rgba(154,33,67,0.18)`, 
              marginBottom: 20 
            }}>
              <span style={{ 
                width: 7, 
                height: 7, 
                borderRadius: '50%', 
                background: CR, 
                display: 'inline-block', 
                animation: 'wPulse 1.5s ease-in-out infinite' 
              }} />
              <span style={{ 
                fontSize: 10, 
                fontWeight: 700, 
                color: CR, 
                letterSpacing: 1.5 
              }}>
                PRIVATE BETA
              </span>
            </div>
          )}

          <h1 style={{ 
            margin: '0 0 12px', 
            fontSize: 30, 
            fontWeight: 700,
            color: DK, 
            fontFamily: 'Georgia, serif', 
            lineHeight: 1.2 
          }}>
            Welcome to uMshado
          </h1>
          <p style={{ 
            margin: 0, 
            fontSize: 14.5, 
            color: '#6b4a54', 
            lineHeight: 1.65,
            maxWidth: 340,
            marginLeft: 'auto',
            marginRight: 'auto'
          }}>
            {BETA_INVITE_ONLY
              ? 'Your all-in-one South African wedding planning platform — currently in private beta.'
              : 'Plan your dream wedding, discover trusted vendors, and celebrate every milestone.'}
          </p>
        </div>

        {/* Divider */}
        <div style={{ 
          height: 1, 
          background: `linear-gradient(90deg, transparent, rgba(154,33,67,0.12), transparent)`, 
          margin: '0 0 28px' 
        }} />

        {/* Action buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {BETA_INVITE_ONLY ? (
            <>
              <Link 
                href="/auth/sign-in"
                style={{ 
                  display: 'block', 
                  width: '100%', 
                  padding: '15px 20px', 
                  borderRadius: 16, 
                  background: `linear-gradient(135deg, ${CR}, ${CR2})`, 
                  color: '#fff', 
                  fontSize: 15, 
                  fontWeight: 700, 
                  textAlign: 'center', 
                  textDecoration: 'none', 
                  boxShadow: '0 4px 16px rgba(154,33,67,0.28)', 
                  boxSizing: 'border-box',
                  transition: 'transform 0.2s, box-shadow 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(154,33,67,0.35)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(154,33,67,0.28)';
                }}
              >
                Sign In
              </Link>
              <Link 
                href="/request-access"
                style={{ 
                  display: 'block', 
                  width: '100%', 
                  padding: '15px 20px', 
                  borderRadius: 16, 
                  background: 'transparent', 
                  color: CR, 
                  fontSize: 15, 
                  fontWeight: 700, 
                  textAlign: 'center', 
                  textDecoration: 'none', 
                  border: `1.5px solid rgba(154,33,67,0.25)`, 
                  boxSizing: 'border-box',
                  transition: 'background 0.2s, border-color 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(154,33,67,0.05)';
                  e.currentTarget.style.borderColor = `rgba(154,33,67,0.4)`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = `rgba(154,33,67,0.25)`;
                }}
              >
                Request Access
              </Link>
            </>
          ) : (
            <>
              <Link 
                href="/auth/sign-up?role=couple"
                style={{ 
                  display: 'block', 
                  width: '100%', 
                  padding: '15px 20px', 
                  borderRadius: 16, 
                  background: `linear-gradient(135deg, ${CR}, ${CR2})`, 
                  color: '#fff', 
                  fontSize: 15, 
                  fontWeight: 700, 
                  textAlign: 'center', 
                  textDecoration: 'none', 
                  boxShadow: '0 4px 16px rgba(154,33,67,0.28)', 
                  boxSizing: 'border-box',
                  transition: 'transform 0.2s, box-shadow 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(154,33,67,0.35)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(154,33,67,0.28)';
                }}
              >
                💍 I&apos;m planning a wedding
              </Link>
              <Link 
                href="/auth/sign-up?role=vendor"
                style={{ 
                  display: 'block', 
                  width: '100%', 
                  padding: '15px 20px', 
                  borderRadius: 16, 
                  background: 'transparent', 
                  color: CR, 
                  fontSize: 15, 
                  fontWeight: 700, 
                  textAlign: 'center', 
                  textDecoration: 'none', 
                  border: `1.5px solid rgba(154,33,67,0.25)`, 
                  boxSizing: 'border-box',
                  transition: 'background 0.2s, border-color 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(154,33,67,0.05)';
                  e.currentTarget.style.borderColor = `rgba(154,33,67,0.4)`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = `rgba(154,33,67,0.25)`;
                }}
              >
                🏪 I&apos;m a wedding vendor
              </Link>
            </>
          )}
        </div>

        {/* Sign in link */}
        <p style={{ 
          margin: '24px 0 0', 
          textAlign: 'center', 
          fontSize: 13.5, 
          color: '#7a5060' 
        }}>
          Already have an account?{' '}
          <Link 
            href="/auth/sign-in" 
            style={{ 
              color: CR, 
              fontWeight: 700, 
              textDecoration: 'none',
              transition: 'color 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = CR2}
            onMouseLeave={(e) => e.currentTarget.style.color = CR}
          >
            Sign in
          </Link>
        </p>
      </div>
      
      <style>{`
        @keyframes wPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
