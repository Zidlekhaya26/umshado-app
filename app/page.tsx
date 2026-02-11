import Link from 'next/link';
import { BETA_INVITE_ONLY } from '@/lib/betaGate';
import { UmshadoLogo } from '@/components/ui/UmshadoLogo';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-500 via-purple-600 to-pink-500 flex items-center justify-center p-4">
      <div className="mx-auto w-full max-w-md lg:max-w-6xl lg:px-6 bg-white rounded-2xl shadow-2xl p-8">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="animate-umshado-in mb-4">
            <UmshadoLogo iconSize={64} />
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
              : 'Plan your dream wedding, discover trusted vendors, and celebrate every milestone.'}
          </p>
        </div>

        {/* Action Buttons */}
        {BETA_INVITE_ONLY ? (
          <div className="space-y-3">
            <Link
              href="/auth/sign-in"
              className="block w-full px-6 py-3.5 bg-purple-600 text-white rounded-xl font-bold text-center text-base hover:bg-purple-700 transition-colors shadow-lg shadow-purple-200 active:scale-95"
            >
              Sign In
            </Link>
            <Link
              href="/request-access"
              className="block w-full px-6 py-3.5 bg-white text-purple-600 border-2 border-purple-600 rounded-xl font-bold text-center text-base hover:bg-purple-50 transition-colors active:scale-95"
            >
              Request Access
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            <Link
              href="/auth/sign-up?role=couple"
              className="block w-full px-6 py-3.5 bg-purple-600 text-white rounded-xl font-bold text-center text-base hover:bg-purple-700 transition-colors shadow-lg shadow-purple-200 active:scale-95"
            >
              I&apos;m planning a wedding
            </Link>
            <Link
              href="/auth/sign-up?role=vendor"
              className="block w-full px-6 py-3.5 bg-white text-purple-600 border-2 border-purple-600 rounded-xl font-bold text-center text-base hover:bg-purple-50 transition-colors active:scale-95"
            >
              I&apos;m a wedding vendor
            </Link>
          </div>
        )}

        {/* Already have an account */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Already have an account?{' '}
            <Link href="/auth/sign-in" className="text-purple-600 font-bold hover:text-purple-700 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
