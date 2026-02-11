'use client';

import Link from 'next/link';
import BottomNav from '@/components/BottomNav';

const LAST_UPDATED = '1 February 2026';
const VERSION = 'v1.0';

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full max-w-screen-xl mx-auto min-h-screen flex flex-col pb-24 px-4">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-4 py-5">
          <div className="flex items-center gap-3">
            <Link href="/settings" className="p-1 -ml-1 rounded-full hover:bg-gray-100 transition-colors">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Privacy Policy</h1>
              <p className="text-xs text-gray-500 mt-0.5">Last updated: {LAST_UPDATED} · {VERSION}</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-6 prose prose-sm max-w-none">
          <h2 className="text-base font-bold text-gray-900 mb-2">1. Introduction</h2>
          <p className="text-sm text-gray-700 leading-relaxed mb-4">
            uMshado (Pty) Ltd (&quot;uMshado&quot;, &quot;we&quot;, &quot;us&quot;) is committed to protecting your personal information in accordance with the Protection of Personal Information Act 4 of 2013 (POPIA) and other applicable South African legislation. This Privacy Policy explains how we collect, use, store, and protect your data when you use the uMshado application (&quot;App&quot;).
          </p>

          <h2 className="text-base font-bold text-gray-900 mb-2">2. Information We Collect</h2>
          <p className="text-sm text-gray-700 leading-relaxed mb-1">We collect the following types of information:</p>
          <ul className="text-sm text-gray-700 leading-relaxed mb-4 list-disc list-inside space-y-1">
            <li><span className="font-semibold">Account information:</span> Email address, name, and password (hashed) when you register</li>
            <li><span className="font-semibold">Profile information:</span> Partner name, wedding date, location, country, and profile photo</li>
            <li><span className="font-semibold">Planning data:</span> Tasks, budget items, guest lists, and RSVP statuses you create</li>
            <li><span className="font-semibold">Vendor data:</span> Business name, category, description, media, packages, and pricing (for vendor accounts)</li>
            <li><span className="font-semibold">Communications:</span> Messages exchanged between couples and vendors through the App</li>
            <li><span className="font-semibold">Quote requests:</span> Event details, requirements, and vendor responses</li>
            <li><span className="font-semibold">Live event data:</span> Wedding-day schedules, well wishes, and guest-shared moments</li>
            <li><span className="font-semibold">Support data:</span> Support tickets, bug reports, and feedback you submit</li>
            <li><span className="font-semibold">Device information:</span> Browser type, device type, and IP address (collected automatically for security and diagnostics)</li>
          </ul>

          <h2 className="text-base font-bold text-gray-900 mb-2">3. How We Use Your Information</h2>
          <p className="text-sm text-gray-700 leading-relaxed mb-1">We use your information to:</p>
          <ul className="text-sm text-gray-700 leading-relaxed mb-4 list-disc list-inside space-y-1">
            <li>Provide and operate the App&apos;s features (planning tools, marketplace, messaging, live event sharing)</li>
            <li>Authenticate your identity and secure your account</li>
            <li>Connect couples with vendors through quote requests and messaging</li>
            <li>Send in-app notifications about quote updates, messages, and booking statuses</li>
            <li>Respond to support requests and improve the App</li>
            <li>Comply with legal obligations</li>
          </ul>

          <h2 className="text-base font-bold text-gray-900 mb-2">4. Data Storage and Security</h2>
          <p className="text-sm text-gray-700 leading-relaxed mb-4">
            Your data is stored using Supabase, a secure cloud platform built on PostgreSQL. We use Row Level Security (RLS) to ensure that each user can only access their own data. All data transmissions are encrypted using HTTPS/TLS. Passwords are securely hashed and never stored in plain text. We follow industry-standard security practices to protect your information from unauthorised access, disclosure, or destruction.
          </p>

          <h2 className="text-base font-bold text-gray-900 mb-2">5. Data Sharing</h2>
          <p className="text-sm text-gray-700 leading-relaxed mb-1">We do not sell your personal information. We may share your data only in the following circumstances:</p>
          <ul className="text-sm text-gray-700 leading-relaxed mb-4 list-disc list-inside space-y-1">
            <li><span className="font-semibold">With vendors:</span> When you submit a quote request, the vendor receives the details you included in that request (event date, guest count, requirements). They do not receive access to your profile, guest list, or budget.</li>
            <li><span className="font-semibold">With couples:</span> When a vendor is published on the marketplace, their business name, description, photos, and packages are visible to couples browsing the marketplace.</li>
            <li><span className="font-semibold">Live event guests:</span> When you share a QR code for a Live event, guests can view the schedule, post well wishes, and share moments. Guests access is limited to the specific event and does not include access to your planning data.</li>
            <li><span className="font-semibold">Service providers:</span> We use Supabase for infrastructure. They process data on our behalf under strict data protection agreements.</li>
            <li><span className="font-semibold">Legal requirements:</span> We may disclose information if required by South African law or a valid court order.</li>
          </ul>

          <h2 className="text-base font-bold text-gray-900 mb-2">6. Your Rights Under POPIA</h2>
          <p className="text-sm text-gray-700 leading-relaxed mb-1">Under POPIA, you have the right to:</p>
          <ul className="text-sm text-gray-700 leading-relaxed mb-4 list-disc list-inside space-y-1">
            <li>Access your personal information held by us</li>
            <li>Request correction of inaccurate or incomplete information</li>
            <li>Request deletion of your personal information (subject to legal retention requirements)</li>
            <li>Object to the processing of your personal information</li>
            <li>Withdraw consent for optional data processing</li>
            <li>Lodge a complaint with the Information Regulator of South Africa</li>
          </ul>
          <p className="text-sm text-gray-700 leading-relaxed mb-4">
            To exercise any of these rights, contact us at{' '}
            <a href="mailto:privacy@umshado.co.za" className="text-purple-600 font-semibold hover:underline">privacy@umshado.co.za</a>.
          </p>

          <h2 className="text-base font-bold text-gray-900 mb-2">7. Data Retention</h2>
          <p className="text-sm text-gray-700 leading-relaxed mb-4">
            We retain your personal information for as long as your account is active or as needed to provide the service. If you request account deletion, we will remove your data within 30 days, except where retention is required by law. Anonymised, aggregated data may be retained for analytics purposes.
          </p>

          <h2 className="text-base font-bold text-gray-900 mb-2">8. Cookies and Analytics</h2>
          <p className="text-sm text-gray-700 leading-relaxed mb-4">
            The App uses essential cookies for authentication and session management. We do not use third-party advertising cookies. We may collect basic analytics data (page views, feature usage) to improve the App. This data is aggregated and does not identify individual users.
          </p>

          <h2 className="text-base font-bold text-gray-900 mb-2">9. Children&apos;s Privacy</h2>
          <p className="text-sm text-gray-700 leading-relaxed mb-4">
            The App is not intended for children under the age of 18. We do not knowingly collect personal information from children. If we become aware that a child under 18 has provided us with personal information, we will take steps to delete it.
          </p>

          <h2 className="text-base font-bold text-gray-900 mb-2">10. Changes to This Policy</h2>
          <p className="text-sm text-gray-700 leading-relaxed mb-4">
            We may update this Privacy Policy from time to time. When we do, we will revise the &quot;Last updated&quot; date and version number. Material changes will be communicated through the App. Your continued use of the App after changes constitutes acceptance of the updated policy.
          </p>

          <h2 className="text-base font-bold text-gray-900 mb-2">11. Information Officer</h2>
          <p className="text-sm text-gray-700 leading-relaxed mb-4">
            Our designated Information Officer can be contacted at{' '}
            <a href="mailto:privacy@umshado.co.za" className="text-purple-600 font-semibold hover:underline">privacy@umshado.co.za</a>{' '}
            for any questions about this Privacy Policy or how we handle your data.
          </p>

          <h2 className="text-base font-bold text-gray-900 mb-2">12. Contact</h2>
          <p className="text-sm text-gray-700 leading-relaxed mb-4">
            For privacy-related enquiries, please contact us at{' '}
            <a href="mailto:privacy@umshado.co.za" className="text-purple-600 font-semibold hover:underline">privacy@umshado.co.za</a>.
            <br />
            For general support, contact{' '}
            <a href="mailto:support@umshado.co.za" className="text-purple-600 font-semibold hover:underline">support@umshado.co.za</a>.
          </p>

          <div className="border-t border-gray-200 pt-4 mt-6">
            <p className="text-xs text-gray-400 text-center">
              uMshado (Pty) Ltd · South Africa · {VERSION}
            </p>
          </div>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
