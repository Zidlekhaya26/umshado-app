"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import ProfileCompletionIndicator from '@/components/ProfileCompletionIndicator';
import { supabase } from '@/lib/supabaseClient';
import { getVendorSetupStatus } from '@/lib/vendorOnboarding';

type PreferredContact = 'chat' | 'whatsapp' | 'call';

export default function VendorMedia() {
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [portfolioUrls, setPortfolioUrls] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [socialLinks, setSocialLinks] = useState({ instagram: '', facebook: '', tiktok: '', website: '' });
  const [contact, setContact] = useState({ whatsapp: '', phone: '', preferredContact: 'whatsapp' as PreferredContact });
  const [isPublished, setIsPublished] = useState<boolean>(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean>(false);
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }

        let vendor: any = null;
        const { data: v1 } = await supabase.from('vendors').select('id, logo_url, cover_url, portfolio_urls, social_links, contact, is_published, onboarding_completed').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (v1) { vendor = v1; } else {
          const { data: v2 } = await supabase.from('vendors').select('id, logo_url, cover_url, portfolio_urls, social_links, contact, is_published, onboarding_completed').eq('id', user.id).maybeSingle();
          if (v2) vendor = v2;
        }

        if (vendor) {
          setVendorId(vendor.id);
          setLogoUrl(vendor.logo_url || null);
          setCoverUrl(vendor.cover_url || null);
          setPortfolioUrls(vendor.portfolio_urls || []);
          if (typeof vendor.is_published === 'boolean') setIsPublished(Boolean(vendor.is_published));
          if (typeof vendor.onboarding_completed === 'boolean') setOnboardingCompleted(Boolean(vendor.onboarding_completed));
          if (vendor.social_links) { setSocialLinks({ instagram: '', facebook: '', tiktok: '', website: '', ...vendor.social_links }); if (vendor.social_links.youtube) setVideoUrl(vendor.social_links.youtube); }
          if (vendor.contact) setContact({ whatsapp: '', phone: '', preferredContact: 'whatsapp', ...vendor.contact });
        }
      } catch (err) { console.error('Error loading vendor media:', err); } finally { setLoading(false); }
    })();
  }, []);

  useEffect(() => {
    if (!vendorId) return;
    (async () => {
      try {
        const status = await getVendorSetupStatus(supabase, vendorId);
        setNeedsOnboarding(Boolean(status.needsOnboarding));
      } catch (e) {
        console.warn('Unable to determine onboarding status for media page:', e);
      }
    })();
  }, [vendorId]);
  const uploadFile = async (file: File, folder: string): Promise<string | null> => {
    if (!vendorId) return null;
    const ext = file.name.split('.').pop() || 'jpg';
    const filePath = `${vendorId}/${folder}/${Date.now()}.${ext}`;

    const { error } = await supabase.storage.from('vendor-media').upload(filePath, file, { cacheControl: '3600', upsert: false });
    if (error) { console.error('Upload error:', error); return null; }

    const { data } = supabase.storage.from('vendor-media').getPublicUrl(filePath) as any;
    return data?.publicUrl || null;
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'cover' | 'portfolio') => {
    const files = e.target.files;
    if (!files || files.length === 0 || !vendorId) return;
    setUploading(true);

    try {
      if (type === 'portfolio') {
        const newUrls: string[] = [];
        for (const file of Array.from(files)) { const url = await uploadFile(file, 'portfolio'); if (url) newUrls.push(url); }
        setPortfolioUrls(prev => [...prev, ...newUrls]);
      } else {
        const url = await uploadFile(files[0], type);
        if (url) { if (type === 'logo') setLogoUrl(url); else setCoverUrl(url); }
      }
    } catch (err) { console.error('Upload failed:', err); alert('Upload failed. Please try again.'); } finally { setUploading(false); }
  };

  const removePortfolioImage = (index: number) => setPortfolioUrls(portfolioUrls.filter((_, i) => i !== index));

  const handleSave = async () => {
    if (!vendorId) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('vendors').update({ logo_url: logoUrl, cover_url: coverUrl, portfolio_urls: portfolioUrls, portfolio_images: portfolioUrls.length, social_links: { ...socialLinks, ...(videoUrl.trim() ? { youtube: videoUrl.trim() } : {}) }, contact }).eq('id', vendorId);
      if (error) { console.error('Save error:', error); alert('Failed to save. Please try again.'); }
    } catch (err) { console.error('Save error:', err); } finally { setSaving(false); }
  };

  const hasAtLeastOneSocialLink = Object.values(socialLinks).some(link => link.trim() !== '');
  const canContinue = Boolean(logoUrl) && (portfolioUrls.length >= 3 || hasAtLeastOneSocialLink);
  const [forcedEdit, setForcedEdit] = useState(false);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      setForcedEdit(sp.get('mode') === 'edit');
    }
  }, []);
  const modeParamOnboarding = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('mode') === 'onboarding';
  const isOnboarding = modeParamOnboarding || Boolean(needsOnboarding);
  const editMode = !isOnboarding;
  const backHref = editMode ? '/vendor/dashboard' : '/vendor/packages?mode=onboarding';
  const primaryLabel = saving ? 'Saving...' : isOnboarding ? 'Save & Continue' : 'Save';

  if (loading) return (<div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" /></div>);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full max-w-none md:max-w-screen-xl md:mx-auto min-h-[100svh] flex flex-col pb-20 pb-[calc(env(safe-area-inset-bottom)+80px)] px-4">
        <div className="bg-white border-b border-gray-200 px-4 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Media & Portfolio</h1>
            <p className="text-sm text-gray-600 mt-1.5">Upload your work so couples can trust you</p>
          </div>
          {editMode && (
            <div className="flex items-center gap-2">
              <Link href="/vendor/dashboard" className="px-3 py-2 rounded-lg bg-gray-100 text-sm font-semibold text-gray-700 hover:bg-gray-200">Home</Link>
            </div>
          )}
        </div>

        <div className="flex-1 px-4 py-5 space-y-6 overflow-y-auto">
          {uploading && <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700 font-medium flex items-center gap-2"><div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />Uploading...</div>}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Business Logo <span className="text-red-500">*</span></label>
            {logoUrl ? (
              <div className="relative w-32 h-32 rounded-xl overflow-hidden border-2 border-gray-300 flex items-center justify-center">
                <Image src={logoUrl} alt="Business logo" fill sizes="128px" className="object-contain p-2" />
                <button type="button" onClick={() => setLogoUrl(null)} className="absolute top-1 right-1 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-purple-300 rounded-xl cursor-pointer hover:border-purple-400 hover:bg-purple-50 transition-colors"><svg className="w-10 h-10 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg><span className="mt-2 text-sm font-medium text-purple-600">Upload Logo</span><input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'logo')} className="hidden" /></label>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Cover Image <span className="text-gray-400 text-xs font-normal">(Optional)</span></label>
            {coverUrl ? (
              <div className="relative w-full h-48 rounded-xl overflow-hidden border-2 border-gray-300"><Image src={coverUrl} alt="Cover image" fill sizes="100vw" className="object-cover" /><button type="button" onClick={() => setCoverUrl(null)} className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button></div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-gray-400 hover:bg-gray-50 transition-colors"><svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg><span className="mt-2 text-sm font-medium text-gray-600">Upload Cover Image</span><input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'cover')} className="hidden" /></label>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Portfolio Gallery <span className="text-red-500">*</span></label>
            <p className="text-xs text-gray-500 mb-3">Add at least 3 photos (recommended 6+)</p>
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-purple-300 rounded-xl cursor-pointer hover:border-purple-400 hover:bg-purple-50 transition-colors mb-3"><svg className="w-10 h-10 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg><span className="mt-2 text-sm font-medium text-purple-600">Add Portfolio Images</span><span className="text-xs text-gray-500 mt-1">{portfolioUrls.length} image{portfolioUrls.length !== 1 ? 's' : ''} uploaded</span><input type="file" accept="image/*" multiple onChange={(e) => handleImageUpload(e, 'portfolio')} className="hidden" /></label>
            {portfolioUrls.length > 0 && <div className="grid grid-cols-3 gap-2">{portfolioUrls.map((url, index) => (<div key={index} className="relative aspect-square rounded-lg overflow-hidden border-2 border-gray-200"><Image src={url} alt={`Portfolio ${index + 1}`} fill sizes="(max-width: 768px) 33vw, 200px" className="object-cover" /><button type="button" onClick={() => removePortfolioImage(index)} className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button></div>))}</div>}
          </div>

          <div>
            <h2 className="text-base font-semibold text-gray-900 mb-2">Video Showreel</h2>
            <p className="text-xs text-gray-500 mb-3">Paste a YouTube link to showcase your work</p>
            <input type="url" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=..." className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-base placeholder:text-gray-400" />
            {videoUrl.trim() && (() => {
              const extractYouTubeId = (url: string): string | null => {
                const patterns = [/(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/, /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/, /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/, /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/];
                for (const p of patterns) { const m = url.match(p); if (m) return m[1]; }
                return null;
              };
              const ytId = extractYouTubeId(videoUrl.trim());
              if (!ytId) return (<p className="text-xs text-amber-600 mt-2">Paste a valid YouTube URL to see the preview</p>);
              return (<div className="mt-3 rounded-xl overflow-hidden border-2 border-gray-200"><div className="relative w-full" style={{ paddingBottom: '56.25%' }}><iframe className="absolute inset-0 w-full h-full" src={`https://www.youtube.com/embed/${ytId}`} title="Video preview" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /></div></div>);
            })()}
          </div>

          <div>
            <h2 className="text-base font-semibold text-gray-900 mb-3">Social Media Links</h2>
            <div className="space-y-3">{(['instagram', 'facebook', 'tiktok', 'website'] as const).map((key) => (<div key={key}><label className="block text-sm font-medium text-gray-700 mb-1.5 capitalize">{key}</label><input type="url" value={(socialLinks as any)[key]} onChange={(e) => setSocialLinks({ ...socialLinks, [key]: e.target.value })} placeholder={`https://${key === 'website' ? 'yourbusiness.com' : key + '.com/yourbusiness'}`} className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-base placeholder:text-gray-400" /></div>))}</div>
          </div>

          <div>
            <h2 className="text-base font-semibold text-gray-900 mb-3">Contact Information</h2>
            <div className="space-y-3">
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">WhatsApp Number</label><input type="tel" value={contact.whatsapp} onChange={(e) => setContact({ ...contact, whatsapp: e.target.value })} placeholder="+27 XX XXX XXXX" className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-base placeholder:text-gray-400" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Call Number</label><input type="tel" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} placeholder="+27 XX XXX XXXX" className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-base placeholder:text-gray-400" /></div>
              <div><label className="block text-sm font-semibold text-gray-700 mb-2">Preferred Contact Method</label><div className="flex gap-2">{(['chat', 'whatsapp', 'call'] as const).map((method) => (<button key={method} type="button" onClick={() => setContact({ ...contact, preferredContact: method })} className={`flex-1 px-4 py-3 rounded-xl border-2 font-semibold text-sm transition-all capitalize ${contact.preferredContact === method ? 'bg-purple-50 border-purple-500 text-purple-700 shadow-sm' : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'}`}>{method}</button>))}</div></div>
            </div>
          </div>

          {!canContinue && <div className="bg-purple-50 border border-purple-200 rounded-xl px-4 py-3.5"><p className="text-sm text-purple-900">{!logoUrl && <span className="block">• Upload your business logo</span>}{logoUrl && portfolioUrls.length < 3 && !hasAtLeastOneSocialLink && (<span className="block">• Add at least 3 portfolio images OR fill in a social media link</span>)}</p></div>}
        </div>
      </div>

        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-4 z-40">
        <div className="w-full max-w-none md:max-w-screen-xl md:mx-auto flex gap-3 px-4">
          <Link href={backHref} className="flex-1 px-4 py-3.5 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold text-base text-center hover:bg-gray-50 active:bg-gray-100 transition-colors">Back</Link>
          <button onClick={async () => { await handleSave(); if (canContinue) { if (isOnboarding) window.location.href = '/vendor/review?mode=onboarding'; else alert('Saved'); } }} disabled={!canContinue || saving} className={`flex-1 px-4 py-3.5 rounded-xl font-semibold text-base text-center transition-all ${canContinue && !saving ? 'bg-purple-600 text-white hover:bg-purple-700 active:scale-95 shadow-lg shadow-purple-200' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}>{primaryLabel}</button>
        </div>
      </div>
    </div>
  );
}
