'use client';

import Link from 'next/link';
import BottomNav from '@/components/BottomNav';

const LAST_UPDATED = '1 February 2026';
const VERSION = 'v1.0';

export default function TermsOfServicePage() {
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
              <h1 className="text-xl font-bold text-gray-900">Terms of Service</h1>
              <p className="text-xs text-gray-500 mt-0.5">Last updated: {LAST_UPDATED} · {VERSION}</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-6 prose prose-sm max-w-none">
          <h2 className="text-base font-bold text-gray-900 mb-2">1. Acceptance of Terms</h2>
          <p className="text-sm text-gray-700 leading-relaxed mb-4">
            By accessing or using the uMshado application (&quot;App&quot;), you agree to be bound by these Terms of Service (&quot;Terms&quot;). If you do not agree to these Terms, do not use the App. uMshado is operated by uMshado (Pty) Ltd, a company registered in South Africa.
          </p>

          <h2 className="text-base font-bold text-gray-900 mb-2">2. Description of Service</h2>
          <p className="text-sm text-gray-700 leading-relaxed mb-4">
            uMshado is a wedding planning platform that connects couples with wedding service vendors. The App provides tools for planning tasks, managing budgets and guest lists, browsing vendor marketplaces, requesting quotes, and sharing wedding-day experiences with guests. The App is currently in a beta / MVP phase and features may change without notice.
          </p>

          <h2 className="text-base font-bold text-gray-900 mb-2">3. User Accounts</h2>
          <p className="text-sm text-gray-700 leading-relaxed mb-4">
            You must create an account to use the App. You are responsible for maintaining the confidentiality of your login credentials and for all activities that occur under your account. You must provide accurate and complete information during registration and keep your account information up to date. You may not share your account with third parties or create multiple accounts for the same person.
          </p>

          <h2 className="text-base font-bold text-gray-900 mb-2">4. Couple and Vendor Roles</h2>
          <p className="text-sm text-gray-700 leading-relaxed mb-4">
            Users may operate in one or both of two roles: Couple (planning a wedding) and Vendor (providing wedding services). Each role has different features and responsibilities. By listing services as a Vendor, you represent that you have the legal right and capacity to provide those services.
          </p>

          <h2 className="text-base font-bold text-gray-900 mb-2">5. User Content</h2>
          <p className="text-sm text-gray-700 leading-relaxed mb-4">
            You retain ownership of all content you upload or submit to the App, including text, images, and videos (&quot;User Content&quot;). By submitting User Content, you grant uMshado a non-exclusive, royalty-free licence to use, display, and distribute your content within the App for the purpose of providing the service. You are solely responsible for the legality, accuracy, and appropriateness of your User Content.
          </p>

          <h2 className="text-base font-bold text-gray-900 mb-2">6. Prohibited Conduct</h2>
          <p className="text-sm text-gray-700 leading-relaxed mb-1">You agree not to:</p>
          <ul className="text-sm text-gray-700 leading-relaxed mb-4 list-disc list-inside space-y-1">
            <li>Use the App for any unlawful purpose</li>
            <li>Upload harmful, offensive, or misleading content</li>
            <li>Impersonate another person or entity</li>
            <li>Attempt to gain unauthorised access to the App or its systems</li>
            <li>Interfere with or disrupt the operation of the App</li>
            <li>Scrape, harvest, or collect data from the App without permission</li>
          </ul>

          <h2 className="text-base font-bold text-gray-900 mb-2">7. Payments and Fees</h2>
          <p className="text-sm text-gray-700 leading-relaxed mb-4">
            The App is currently free to use during the beta period. In the future, uMshado may introduce subscription fees for premium features. Any financial transactions between couples and vendors are conducted directly between those parties. uMshado is not a party to such transactions and is not responsible for disputes arising from them.
          </p>

          <h2 className="text-base font-bold text-gray-900 mb-2">8. Intellectual Property</h2>
          <p className="text-sm text-gray-700 leading-relaxed mb-4">
            The App, including its design, code, logos, and documentation, is the intellectual property of uMshado (Pty) Ltd and is protected by copyright and other intellectual property laws. You may not copy, modify, distribute, or reverse-engineer any part of the App without written permission.
          </p>

          <h2 className="text-base font-bold text-gray-900 mb-2">9. Disclaimer of Warranties</h2>
          <p className="text-sm text-gray-700 leading-relaxed mb-4">
            The App is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind, either express or implied. uMshado does not guarantee that the App will be error-free, secure, or uninterrupted. We do not warrant the accuracy, completeness, or reliability of any content provided by vendors or other users.
          </p>

          <h2 className="text-base font-bold text-gray-900 mb-2">10. Limitation of Liability</h2>
          <p className="text-sm text-gray-700 leading-relaxed mb-4">
            To the maximum extent permitted by South African law, uMshado shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the App, including but not limited to loss of profits, data, or goodwill.
          </p>

          <h2 className="text-base font-bold text-gray-900 mb-2">11. Termination</h2>
          <p className="text-sm text-gray-700 leading-relaxed mb-4">
            We may suspend or terminate your account at any time if you violate these Terms or for any other reason at our sole discretion. Upon termination, your right to use the App ceases immediately. You may also delete your account by contacting support.
          </p>

          <h2 className="text-base font-bold text-gray-900 mb-2">12. Governing Law</h2>
          <p className="text-sm text-gray-700 leading-relaxed mb-4">
            These Terms are governed by the laws of the Republic of South Africa. Any disputes arising from these Terms or your use of the App shall be resolved in the courts of South Africa.
          </p>

          <h2 className="text-base font-bold text-gray-900 mb-2">13. Changes to These Terms</h2>
          <p className="text-sm text-gray-700 leading-relaxed mb-4">
            We may update these Terms from time to time. When we do, we will revise the &quot;Last updated&quot; date at the top. Your continued use of the App after changes are posted constitutes acceptance of the updated Terms.
          </p>

          <h2 className="text-base font-bold text-gray-900 mb-2">14. Contact</h2>
          <p className="text-sm text-gray-700 leading-relaxed mb-4">
            If you have any questions about these Terms, please contact us at{' '}
            <a href="mailto:legal@umshado.co.za" className="text-purple-600 font-semibold hover:underline">
              legal@umshado.co.za
            </a>.
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
