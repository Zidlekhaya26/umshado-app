"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';

interface Props {
  vendorId: string;
  whatsapp?: string | null;
}

export default function PublicVendorCTAs({ vendorId, whatsapp }: Props) {
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (mounted) setRole(null);
          return;
        }
        const { data } = await supabase.from('profiles').select('role,active_role').eq('id', user.id).maybeSingle();
        if (mounted) setRole(data?.active_role || data?.role || null);
      } catch (err) {
        console.error('PublicVendorCTAs error', err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [vendorId]);

  const publicPath = `/v/${vendorId}`;

  if (loading) return <div className="space-x-2" />;

  // Not logged in
  if (!role) {
    const signInForMessage = `/auth/sign-in?redirect=${encodeURIComponent(publicPath + '?action=message')}`;
    const signInForQuote = `/auth/sign-in?redirect=${encodeURIComponent(publicPath + '?action=quote')}`;
    return (
      <div className="flex items-center gap-2">
        <Link href={signInForMessage} className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-semibold">Message</Link>
        <Link href={signInForQuote} className="px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm">Request Quote</Link>
        {whatsapp && (
          <a href={`https://wa.me/${whatsapp.replace(/[^0-9]/g, '')}`} rel="noopener noreferrer" target="_blank" className="px-3 py-2 rounded-lg bg-green-50 text-green-700 text-sm">WhatsApp</a>
        )}
      </div>
    );
  }

  // Logged-in vendor preview
  if (role === 'vendor') {
    return (
      <div className="space-y-2">
        <div className="inline-block px-3 py-1 bg-yellow-50 text-yellow-800 rounded-md text-sm">Preview mode — this is how couples see your profile</div>
        <div className="flex items-center gap-2">
          <Link href="/vendor/profile/edit" className="px-3 py-2 rounded-lg bg-gray-100 text-sm">Edit Profile</Link>
          <Link href="/vendor/dashboard" className="px-3 py-2 rounded-lg bg-white border text-sm">View Dashboard</Link>
          <button onClick={() => { navigator.share ? navigator.share({ title: 'uMshado Vendor', url: window.location.href }) : navigator.clipboard.writeText(window.location.href).then(()=>alert('Link copied')) }} className="px-3 py-2 rounded-lg bg-[#7B1E3A] text-white text-sm">Share Profile</button>
        </div>
      </div>
    );
  }

  // Logged-in couple
  return (
    <div className="flex items-center gap-2">
      <Link href={`/messages/new?vendor=${vendorId}`} className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-semibold">Message</Link>
      <Link href={`/quotes/new?vendor=${vendorId}`} className="px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm">Request Quote</Link>
      {whatsapp && (
        <a href={`https://wa.me/${whatsapp.replace(/[^0-9]/g, '')}`} rel="noopener noreferrer" target="_blank" className="px-3 py-2 rounded-lg bg-green-50 text-green-700 text-sm">WhatsApp</a>
      )}
    </div>
  );
}
