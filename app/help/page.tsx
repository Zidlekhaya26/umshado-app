'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { UmshadoIcon } from '@/components/ui/UmshadoLogo';
import BottomNav from '@/components/BottomNav';

// ─── FAQ Data (local constant — can be moved to DB later) ─────────

interface FaqItem {
  id: string;
  question: string;
  answer: string;
  category: string;
}

const FAQ_CATEGORIES = ['Account', 'Couples', 'Vendors', 'Quotes', 'Payments', 'Privacy'] as const;

const FAQ_DATA: FaqItem[] = [
  // Account
  {
    id: 'acct-1',
    question: 'How do I create an account?',
    answer: 'Tap "Get Started" on the landing page and sign up with your email. During the beta you\'ll need an invite link. Once registered you can set up a Couple profile, a Vendor profile, or both.',
    category: 'Account',
  },
  {
    id: 'acct-2',
    question: 'Can I have both a couple and vendor profile?',
    answer: 'Yes! You can set up both profiles under one account. Use the "Switch Account" section in Settings to toggle between Couple mode and Vendor mode at any time.',
    category: 'Account',
  },
  {
    id: 'acct-3',
    question: 'How do I change my email or password?',
    answer: 'Go to Settings → Edit Profile to update your display name. To change your email or password, use the Supabase password-reset flow from the sign-in page. Full in-app email/password change is coming in a future release.',
    category: 'Account',
  },
  {
    id: 'acct-4',
    question: 'How do I delete my account?',
    answer: 'During the MVP, please contact support at support@umshado.co.za to request account deletion. We\'ll remove your data within 7 business days. Self-service account deletion is on the roadmap.',
    category: 'Account',
  },

  // Couples
  {
    id: 'couple-1',
    question: 'How do I set my wedding date?',
    answer: 'Go to your Couple Dashboard and tap the pencil icon on the countdown card, or go to Settings → Edit Profile and set your Wedding Date there. The date is stored securely and used for countdown calculations.',
    category: 'Couples',
  },
  {
    id: 'couple-2',
    question: 'How does the Planner work?',
    answer: 'The Planner has three tabs: Tasks, Budget, and Guests. Add tasks with due dates to track milestones, budget items with amounts and payments to track spending, and guests with RSVP status and side assignments.',
    category: 'Couples',
  },
  {
    id: 'couple-3',
    question: 'Can my partner also access the account?',
    answer: 'Currently, one account manages the couple profile. Shared access / multi-user login for partners is planned for a future release. For now, share your login credentials or plan together on the same device.',
    category: 'Couples',
  },
  {
    id: 'couple-4',
    question: 'What is the Live feature?',
    answer: 'Live lets you create a wedding-day schedule, share a QR code with guests so they can send well wishes and share moments (photos/videos) during the event — no app download required for guests.',
    category: 'Couples',
  },

  // Vendors
  {
    id: 'vendor-1',
    question: 'How do I list my business?',
    answer: 'Sign up and complete the Vendor Onboarding flow. Add your business name, category, location, description, and upload photos. Once your profile is complete you can publish to the Marketplace.',
    category: 'Vendors',
  },
  {
    id: 'vendor-2',
    question: 'How do couples find me?',
    answer: 'Published vendors appear in the Marketplace. Couples can filter by category, location, and price range. Make sure your profile is complete with good photos and a clear description to stand out.',
    category: 'Vendors',
  },
  {
    id: 'vendor-3',
    question: 'Can I add service packages?',
    answer: 'Yes. Go to Vendor Dashboard → Packages to create packages with pricing, descriptions, and what\'s included. Couples can view your packages when they visit your vendor profile.',
    category: 'Vendors',
  },

  // Quotes
  {
    id: 'quote-1',
    question: 'How do I request a quote?',
    answer: 'Browse the Marketplace, find a vendor you like, and tap "Request Quote". Fill in the event details and any specific requirements. The vendor will receive your request and can respond via Messages.',
    category: 'Quotes',
  },
  {
    id: 'quote-2',
    question: 'How long does a vendor take to respond?',
    answer: 'Response times vary by vendor. Most vendors respond within 24–48 hours. You can check the status of your quotes on your Dashboard under "Recent Quote Requests".',
    category: 'Quotes',
  },
  {
    id: 'quote-3',
    question: 'Can I cancel a quote request?',
    answer: 'Quote requests cannot be cancelled once sent, but you can message the vendor to let them know you\'re no longer interested. The vendor can update the quote status on their end.',
    category: 'Quotes',
  },

  // Payments
  {
    id: 'pay-1',
    question: 'Can I pay vendors through uMshado?',
    answer: 'In-app payments are not yet available during the MVP. Currently you can track payments manually using the Budget section of the Planner. Integrated payments are on our roadmap.',
    category: 'Payments',
  },
  {
    id: 'pay-2',
    question: 'How does the budget tracker work?',
    answer: 'Go to Planner → Budget to add budget items with total amounts and categories. You can record payments as you make them, and the progress bar shows how much you\'ve paid vs total budget.',
    category: 'Payments',
  },
  {
    id: 'pay-3',
    question: 'Is there a subscription or fee to use uMshado?',
    answer: 'uMshado is currently free during the beta period. We plan to introduce premium features for vendors in the future, but the core couple experience will remain free.',
    category: 'Payments',
  },

  // Privacy
  {
    id: 'priv-1',
    question: 'How is my data stored?',
    answer: 'Your data is stored securely using Supabase (built on PostgreSQL) with Row Level Security (RLS) enabled on all tables. Only you can access your own data. We do not sell or share your personal information.',
    category: 'Privacy',
  },
  {
    id: 'priv-2',
    question: 'Who can see my guest list?',
    answer: 'Only you (the authenticated couple) can see your guest list. Vendors and other users cannot access your guest data. RLS policies ensure strict data isolation.',
    category: 'Privacy',
  },
  {
    id: 'priv-3',
    question: 'Can vendors see my personal details?',
    answer: 'Vendors can only see the information you include in a quote request (event date, guest count, requirements). They cannot access your profile, guest list, budget, or other private data.',
    category: 'Privacy',
  },
];

// ─── Component ──────────────────────────────────────────

export default function HelpPage() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let items = FAQ_DATA;
    if (activeCategory) {
      items = items.filter(i => i.category === activeCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        i => i.question.toLowerCase().includes(q) || i.answer.toLowerCase().includes(q)
      );
    }
    return items;
  }, [search, activeCategory]);

  // Group by category
  const grouped = useMemo(() => {
    const map = new Map<string, FaqItem[]>();
    for (const item of filtered) {
      const list = map.get(item.category) || [];
      list.push(item);
      map.set(item.category, list);
    }
    return map;
  }, [filtered]);

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
              <h1 className="text-xl font-bold text-gray-900">Help / FAQ</h1>
              <p className="text-sm text-gray-600 mt-0.5">Find answers to common questions</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Search */}
          <div className="px-4 pt-4 pb-2">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search questions…"
                className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm text-gray-900"
              />
            </div>
          </div>

          {/* Category Pills */}
          <div className="px-4 py-2 flex gap-2 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveCategory(null)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                !activeCategory ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All
            </button>
            {FAQ_CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                  activeCategory === cat ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* FAQ List */}
          <div className="px-4 py-3 space-y-4">
            {filtered.length === 0 && (
              <div className="text-center py-12">
                <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-gray-900 mb-1">No results found</p>
                <p className="text-xs text-gray-600">Try a different search term or category.</p>
              </div>
            )}

            {Array.from(grouped.entries()).map(([category, items]) => (
              <div key={category}>
                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{category}</h2>
                <div className="bg-white rounded-xl border-2 border-gray-200 divide-y divide-gray-100 overflow-hidden">
                  {items.map(item => (
                    <button
                      key={item.id}
                      onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                      className="w-full text-left px-4 py-3.5 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-900">{item.question}</p>
                        <svg
                          className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform ${expandedId === item.id ? 'rotate-180' : ''}`}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                      {expandedId === item.id && (
                        <p className="text-sm text-gray-600 mt-2 leading-relaxed">{item.answer}</p>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Still need help? */}
          <div className="px-4 py-6">
            <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-5 text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-sm font-bold text-gray-900 mb-1">Still need help?</p>
              <p className="text-xs text-gray-600 mb-4">Our support team is happy to assist you.</p>
              <Link
                href="/support/contact"
                className="inline-block px-5 py-2.5 bg-purple-600 text-white rounded-full text-sm font-semibold hover:bg-purple-700 transition-colors shadow-md"
              >
                Contact Support
              </Link>
            </div>
          </div>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
