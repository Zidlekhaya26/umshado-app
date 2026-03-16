"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getVendorSetupStatus } from '@/lib/vendorOnboarding';
import { getOrCreateVendorForUser, getVendorSelectedServices, getServicesCatalog, type Service } from "@/lib/vendorServices";
import { getPricingType } from "@/lib/marketplaceCategories";
import ProfileCompletionIndicator from "@/components/ProfileCompletionIndicator";
import { useCurrency } from '@/app/providers/CurrencyProvider';

/* ─── Tokens ─────────────────────────────────────────────── */
const CR  = '#9A2143';
const CR2 = '#731832';
const CRX = '#4d0f21';
const GD  = '#BD983F';
const GD2 = '#8a6010';
const DK  = '#1a0d12';
const MID = '#5c3d28';
const MUT = '#7a5060';
const BOR = '#e8d5d0';
const BG  = '#faf8f5';

/* ─── Types ──────────────────────────────────────────────── */
type PricingMode = "guest-based" | "time-based" | "per-person" | "package-based" | "event-based" | "quantity-based";

interface PackageItem {
  id: string;
  name: string;
  fromPrice: number;
  pricingMode: PricingMode;
  guestRange?: { min: number; max: number };
  hours?: number;
  includedServices: string[];
  isPopular: boolean;
}

/* ─── Pricing mode meta ──────────────────────────────────── */
const PRICING_OPTS = [
  { key: 'guest-based',   label: '👥 Guest-based',   hint: 'Catering, décor, equipment' },
  { key: 'time-based',    label: '⏱ Time-based',     hint: 'DJ, photography, MC' },
  { key: 'package-based', label: '📦 Fixed package',  hint: 'All-in-one fixed price' },
] as const;

/* ─── DB mode converters ─────────────────────────────────── */
const dbToApp = (m: string): PricingMode =>
  ({ guest:'guest-based', time:'time-based', 'per-person':'per-person', package:'package-based', event:'event-based', quantity:'quantity-based' } as any)[m] || 'guest-based';

const appToDb = (m: PricingMode): string =>
  ({ 'guest-based':'guest','time-based':'time','per-person':'per-person','package-based':'package','event-based':'event','quantity-based':'quantity' } as any)[m] || 'guest';

/* ─── Small inline spinner ───────────────────────────────── */
function Spin({ size = 18, color = CR }: { size?: number; color?: string }) {
  return (
    <div style={{ width: size, height: size, border: `2px solid rgba(0,0,0,0.08)`, borderTopColor: color, borderRadius: '50%', animation: 'pkgSpin .75s linear infinite', flexShrink: 0 }} />
  );
}

/* ─── Package card ───────────────────────────────────────── */
function PkgCard({ pkg, onEdit, index }: { pkg: PackageItem; onEdit: () => void; index: number }) {
  const { format } = useCurrency();

  const modeLabel = PRICING_OPTS.find(o => o.key === pkg.pricingMode)?.label
    ?? pkg.pricingMode.replace('-', ' ');
  const subLine = pkg.pricingMode === 'guest-based' && pkg.guestRange
    ? `${pkg.guestRange.min}–${pkg.guestRange.max} guests`
    : pkg.pricingMode === 'time-based' && pkg.hours
    ? `${pkg.hours}h coverage`
    : null;

  return (
    <div style={{
      background: '#fff', borderRadius: 18, padding: '18px 20px',
      border: `1.5px solid ${pkg.isPopular ? GD : BOR}`,
      boxShadow: pkg.isPopular ? `0 4px 20px rgba(189,152,63,0.15)` : '0 2px 10px rgba(26,13,18,0.05)',
      display: 'flex', flexDirection: 'column', gap: 12,
      animation: `pkgFade .35s ease ${index * 0.05}s both`,
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Popular accent bar */}
      {pkg.isPopular && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg,${GD2},${GD},${GD2})` }} />
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: DK }}>{pkg.name}</h3>
            {pkg.isPopular && (
              <span style={{ padding: '2px 9px', borderRadius: 20, background: 'rgba(189,152,63,0.12)', border: `1px solid rgba(189,152,63,0.28)`, fontSize: 10.5, fontWeight: 800, color: GD2, letterSpacing: .4 }}>
                ★ MOST POPULAR
              </span>
            )}
          </div>
          <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: DK, fontFamily: 'Georgia,serif', letterSpacing: -.5, lineHeight: 1 }}>
            {format(pkg.fromPrice)}
            <span style={{ fontSize: 11, fontWeight: 600, color: MUT, marginLeft: 4, letterSpacing: 0 }}>from</span>
          </p>
          {subLine && <p style={{ margin: '4px 0 0', fontSize: 12, color: MUT }}>{subLine}</p>}
        </div>

        {/* Edit button */}
        <button onClick={onEdit} style={{
          width: 36, height: 36, borderRadius: 10, border: `1.5px solid ${BOR}`,
          background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', flexShrink: 0, transition: 'border-color .12s,background .12s',
          color: MUT,
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = CR; (e.currentTarget as HTMLElement).style.color = CR; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = BOR; (e.currentTarget as HTMLElement).style.color = MUT; }}
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
          </svg>
        </button>
      </div>

      {/* Pricing mode pill */}
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 20, background: `rgba(154,33,67,0.06)`, border: `1px solid rgba(154,33,67,0.12)`, alignSelf: 'flex-start' }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: CR }}>{modeLabel}</span>
      </div>

      {/* Services tags */}
      {pkg.includedServices.length > 0 && (
        <div>
          <p style={{ margin: '0 0 6px', fontSize: 10.5, fontWeight: 800, color: MUT, letterSpacing: .9, textTransform: 'uppercase' }}>Included</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {pkg.includedServices.map(s => (
              <span key={s} style={{ padding: '3px 10px', borderRadius: 20, background: `rgba(189,152,63,0.09)`, border: `1px solid rgba(189,152,63,0.22)`, fontSize: 11.5, fontWeight: 600, color: MID }}>
                {s}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════ */
export default function VendorPackagesPage() {
  const { format } = useCurrency();

  const [availableServices, setAvailableServices] = useState<string[]>([]);
  const [servicesCatalog, setServicesCatalog]     = useState<Service[]>([]);
  const [vendorCategory, setVendorCategory]       = useState('');
  const [isPublished, setIsPublished]             = useState(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  const [defaultPricingMode, setDefaultPricingMode]   = useState<PricingMode>('guest-based');
  const [needsOnboarding, setNeedsOnboarding]     = useState<boolean | null>(null);
  const [packages, setPackages]                   = useState<PackageItem[]>([]);
  const [loading, setLoading]                     = useState(true);
  const [isFormOpen, setIsFormOpen]               = useState(false);
  const [editingId, setEditingId]                 = useState<string | null>(null);
  const [vendorId, setVendorId]                   = useState<string | null>(null);
  const [saving, setSaving]                       = useState(false);

  const [formData, setFormData] = useState<{
    name: string; fromPrice: string; pricingMode: PricingMode;
    guestRange?: { min: number; max: number }; hours?: number;
    includedServices: string[]; isPopular: boolean;
  }>({ name: '', fromPrice: '', pricingMode: 'guest-based', guestRange: { min: 0, max: 0 }, hours: 0, includedServices: [], isPopular: false });

  const [formErrors, setFormErrors] = useState<{ guestRange?: string; hours?: string }>({});
  const [prevGuestRange, setPrevGuestRange] = useState<{ min: number; max: number } | null>(null);
  const [prevHours, setPrevHours] = useState<number | null>(null);
  const [guestMinRaw, setGuestMinRaw] = useState('');
  const [guestMaxRaw, setGuestMaxRaw] = useState('');
  const [hoursRaw, setHoursRaw]       = useState('');
  const [forcedEdit, setForcedEdit]   = useState(false);

  /* ── Focus trapping for form input ──── */
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const inputStyle = (id: string, err?: string): React.CSSProperties => ({
    width: '100%', padding: '12px 14px', borderRadius: 12, outline: 'none', boxSizing: 'border-box',
    border: `1.5px solid ${err ? '#c0392b' : focusedInput === id ? CR : BOR}`,
    background: '#fff', fontSize: 14, color: DK, fontFamily: 'inherit',
    boxShadow: focusedInput === id ? `0 0 0 3px rgba(154,33,67,0.09)` : 'none',
    transition: 'border-color .14s, box-shadow .14s',
  });

  /* ── Load ─────────────────────────────────────────────── */
  useEffect(() => { loadVendorAndPackages(); }, []);

  useEffect(() => {
    try {
      const isDev = process.env.NODE_ENV === 'development';
      const urlFlag = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debugPackages') === '1';
      setShowDebug(Boolean(isDev || urlFlag));
    } catch { setShowDebug(false); }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setForcedEdit(new URLSearchParams(window.location.search).get('mode') === 'edit');
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = isFormOpen ? 'hidden' : prev || '';
    return () => { document.body.style.overflow = prev || ''; };
  }, [isFormOpen]);

  async function loadVendorAndPackages() {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const vId = await getOrCreateVendorForUser();
      if (!vId) return;
      setVendorId(vId);

      try {
        const { data: vRow } = await supabase.from('vendors').select('category,is_published,onboarding_completed').eq('id', vId).maybeSingle();
        if (vRow?.category) {
          setVendorCategory(vRow.category);
          setDefaultPricingMode(getPricingType(vRow.category) as PricingMode);
        }
        if (vRow) {
          if (typeof vRow.is_published === 'boolean') setIsPublished(Boolean(vRow.is_published));
          if (typeof vRow.onboarding_completed === 'boolean') setOnboardingCompleted(Boolean(vRow.onboarding_completed));
        }
      } catch { /* non-fatal */ }

      try {
        const status = await getVendorSetupStatus(supabase, vId);
        setNeedsOnboarding(Boolean(status.needsOnboarding));
      } catch { /* non-fatal */ }

      try {
        const [selections, catalog] = await Promise.all([getVendorSelectedServices(vId), getServicesCatalog()]);
        setServicesCatalog(catalog || []);
        const catalogMap = new Map<string, Service>((catalog || []).map(s => [s.id, s]));
        const names = (selections?.selectedServiceIds || []).map(id => catalogMap.get(id)?.name).filter(Boolean) as string[];
        setAvailableServices(names.length > 0 ? names : (catalog || []).map(s => s.name));
      } catch { /* non-fatal */ }

      const { data: pkgData } = await supabase.from('vendor_packages').select('*').eq('vendor_id', vId).order('created_at', { ascending: true });
      setPackages((pkgData || []).map((p: any) => ({
        id: p.id, name: p.name, fromPrice: Number(p.base_price),
        pricingMode: dbToApp(p.pricing_mode),
        guestRange: p.pricing_mode === 'guest' ? { min: p.base_guests || 0, max: p.base_guests ? p.base_guests + 50 : 50 } : undefined,
        hours: p.pricing_mode === 'time' ? p.base_hours : undefined,
        includedServices: p.included_services || [],
        isPopular: !!p.is_popular,
      })));
    } catch (err) { console.error('loadVendorAndPackages error:', err); }
    finally { setLoading(false); }
  }

  const openForm = (pkg?: PackageItem) => {
    if (pkg) {
      setEditingId(pkg.id);
      setFormData({ name: pkg.name, fromPrice: String(pkg.fromPrice ?? ''), pricingMode: pkg.pricingMode, guestRange: pkg.guestRange, hours: pkg.hours, includedServices: pkg.includedServices, isPopular: pkg.isPopular });
      setGuestMinRaw(pkg.guestRange?.min ? String(pkg.guestRange.min) : '');
      setGuestMaxRaw(pkg.guestRange?.max ? String(pkg.guestRange.max) : '');
      setHoursRaw(pkg.hours ? String(pkg.hours) : '');
    } else {
      setEditingId(null);
      setFormData({ name: '', fromPrice: '', pricingMode: defaultPricingMode, guestRange: { min: 0, max: 0 }, hours: 0, includedServices: [], isPopular: false });
      setGuestMinRaw(''); setGuestMaxRaw(''); setHoursRaw('');
    }
    setFormErrors({});
    setIsFormOpen(true);
  };

  const closeForm = () => { setIsFormOpen(false); setEditingId(null); };

  const handlePricingModeChange = (mode: PricingMode) => {
    if (formData.pricingMode === 'guest-based') setPrevGuestRange(formData.guestRange ?? null);
    if (formData.pricingMode === 'time-based') setPrevHours(formData.hours ?? null);
    const next = { ...formData, pricingMode: mode } as typeof formData;
    if (mode === 'time-based') next.hours = prevHours && prevHours > 0 ? prevHours : (next.hours && next.hours > 0 ? next.hours : 4);
    if (mode === 'guest-based') next.guestRange = prevGuestRange ?? (next.guestRange && next.guestRange.min > 0 ? next.guestRange : { min: 1, max: 50 });
    if (mode === 'package-based') { next.hours = 0; next.guestRange = { min: 0, max: 0 }; }
    setFormErrors({});
    setFormData(next);
  };

  const savePackage = async () => {
    if (!vendorId) { alert('Vendor profile not loaded'); return; }
    const priceInt = parseInt(formData.fromPrice === '' ? '0' : formData.fromPrice, 10) || 0;
    if (!formData.name || priceInt <= 0) { alert('Please fill in package name and a valid price (> 0)'); return; }
    if (formData.pricingMode === 'guest-based') {
      const mn = formData.guestRange?.min || 0, mx = formData.guestRange?.max || 0;
      if (mn <= 0) { alert('Please set a valid minimum guests (> 0)'); return; }
      if (mn > mx) { alert('Minimum guests must be ≤ maximum guests'); return; }
    }
    if (formData.pricingMode === 'time-based' && (!formData.hours || formData.hours <= 0)) { alert('Please set hours coverage (> 0)'); return; }

    const payload = {
      vendor_id: vendorId, name: formData.name, base_price: priceInt,
      pricing_mode: appToDb(formData.pricingMode),
      base_guests: formData.pricingMode === 'guest-based' ? (formData.guestRange?.min || null) : null,
      base_hours:  formData.pricingMode === 'time-based'  ? (formData.hours || null) : null,
      included_services: formData.includedServices, is_popular: formData.isPopular,
    };

    try {
      setSaving(true);
      if (editingId) {
        const { error } = await supabase.from('vendor_packages').update({ name: payload.name, base_price: payload.base_price, pricing_mode: payload.pricing_mode, base_guests: payload.base_guests, base_hours: payload.base_hours, included_services: payload.included_services, is_popular: payload.is_popular }).eq('id', editingId).select();
        if (error) { console.error('savePackage update error', error); alert(`${error.message}${error.code ? ` (code ${error.code})` : ''}`); return; }
      } else {
        const { error } = await supabase.from('vendor_packages').insert(payload).select();
        if (error) { console.error('savePackage insert error', error); alert(`${error.message}${error.code ? ` (code ${error.code})` : ''}`); return; }
      }
      await loadVendorAndPackages();
      closeForm();
    } catch (err) { console.error('savePackage unexpected error', err); alert('Unexpected error. See console.'); }
    finally { setSaving(false); }
  };

  const deletePackage = async () => {
    if (!editingId || !confirm('Delete this package? This cannot be undone.')) return;
    try {
      setSaving(true);
      const { error } = await supabase.from('vendor_packages').delete().eq('id', editingId);
      if (error) { console.error('deletePackage error', error); alert(`${error.message}${error.code ? ` (code ${error.code})` : ''}`); return; }
      await loadVendorAndPackages();
      closeForm();
    } catch (err) { console.error('deletePackage unexpected error', err); alert('Unexpected error. See console.'); }
    finally { setSaving(false); }
  };

  const canContinue = packages.length >= 2;
  const modeParamOnboarding = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('mode') === 'onboarding';
  const isOnboarding = modeParamOnboarding || Boolean(needsOnboarding);
  const editMode = !isOnboarding && Boolean(forcedEdit || isPublished || onboardingCompleted);
  const modeQuery = isOnboarding ? '?mode=onboarding' : (forcedEdit ? '?mode=edit' : '');

  const formValid =
    (formData.name?.trim().length > 0) &&
    (Number(formData.fromPrice) > 0) &&
    (formData.pricingMode !== 'guest-based' || ((formData.guestRange?.min || 0) > 0 && (formData.guestRange?.min || 0) <= (formData.guestRange?.max || 0))) &&
    (formData.pricingMode !== 'time-based' || ((formData.hours || 0) > 0)) &&
    !Object.values(formErrors).some(Boolean);

  /* ─── Render ────────────────────────────────────────────── */
  return (
    <div style={{ minHeight: '100svh', background: BG, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`
        @keyframes pkgFade { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pkgSheet { from{opacity:0;transform:translateY(40px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pkgSpin { to{transform:rotate(360deg)} }
        input,select,textarea,button{font-family:inherit!important}
        .pkg-svc-btn{transition:all .12s;cursor:pointer;border:none}
        .pkg-svc-btn:hover{filter:brightness(0.96)}
        .pkg-add-btn:hover{border-color:${CR}!important;background:rgba(154,33,67,0.03)!important}
        .pkg-add-btn:hover span{color:${CR}!important}
      `}</style>

      <div style={{ maxWidth: 680, margin: '0 auto', minHeight: '100svh', display: 'flex', flexDirection: 'column', paddingBottom: 'calc(80px + env(safe-area-inset-bottom))' }}>

        <ProfileCompletionIndicator />

        {/* ── Header ──────────────────────────────────────── */}
        <div style={{ background: `linear-gradient(160deg, ${CRX} 0%, ${CR} 52%, #c03050 100%)`, padding: '22px 20px 24px', position: 'relative', overflow: 'hidden' }}>
          {/* Rings */}
          <div style={{ position: 'absolute', top: -60, right: -60, width: 200, height: 200, borderRadius: '50%', border: '1.5px solid rgba(189,152,63,0.1)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', border: '1.5px solid rgba(189,152,63,0.16)', pointerEvents: 'none' }} />

          <div style={{ position: 'relative' }}>
            <p style={{ margin: '0 0 3px', fontSize: 10.5, color: 'rgba(255,255,255,0.45)', letterSpacing: 1.4, textTransform: 'uppercase', fontWeight: 700 }}>Vendor Studio</p>
            <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 800, color: '#fff', fontFamily: 'Georgia,serif', letterSpacing: -.3 }}>Packages & Pricing</h1>
            <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
              Create packages for couples to choose from <span style={{ fontStyle: 'italic' }}>(minimum 2)</span>
            </p>
          </div>
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,transparent,${GD},transparent)` }} />
        </div>

        {/* ── Body ────────────────────────────────────────── */}
        <div style={{ flex: 1, padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Progress pill */}
          <div style={{
            padding: '12px 16px', borderRadius: 14,
            background: canContinue ? 'rgba(30,122,78,0.07)' : 'rgba(154,33,67,0.06)',
            border: `1.5px solid ${canContinue ? 'rgba(30,122,78,0.2)' : 'rgba(154,33,67,0.15)'}`,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: canContinue ? 'rgba(30,122,78,0.12)' : 'rgba(154,33,67,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
              {canContinue ? '✅' : '📦'}
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: canContinue ? '#1e7a4e' : CR }}>
                {packages.length} package{packages.length !== 1 ? 's' : ''} created
              </p>
              {!canContinue && (
                <p style={{ margin: '2px 0 0', fontSize: 12, color: MUT }}>Add at least 2 packages to continue</p>
              )}
            </div>
          </div>

          {/* Loading skeleton */}
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1, 2].map(i => (
                <div key={i} style={{ background: '#fff', borderRadius: 18, padding: '18px 20px', border: `1.5px solid ${BOR}`, opacity: .5 }}>
                  <div style={{ width: '55%', height: 16, borderRadius: 6, background: '#f0e8e5', marginBottom: 10 }} />
                  <div style={{ width: '30%', height: 24, borderRadius: 6, background: '#f0e8e5', marginBottom: 10 }} />
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[80, 60, 70].map(w => <div key={w} style={{ width: w, height: 22, borderRadius: 20, background: '#f0e8e5' }} />)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Package cards */}
          {!loading && packages.map((pkg, i) => (
            <PkgCard key={pkg.id} pkg={pkg} index={i} onEdit={() => openForm(pkg)} />
          ))}

          {/* Empty state */}
          {!loading && packages.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 20px', background: '#fff', borderRadius: 18, border: `1.5px dashed ${BOR}` }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>📦</div>
              <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 800, color: DK, fontFamily: 'Georgia,serif' }}>No packages yet</p>
              <p style={{ margin: 0, fontSize: 13, color: MUT }}>Add your first package to get started</p>
            </div>
          )}

          {/* Add package button */}
          {!loading && (
            <button onClick={() => openForm()} className="pkg-add-btn" style={{
              width: '100%', padding: '18px', borderRadius: 16,
              border: `2px dashed rgba(154,33,67,0.25)`, background: 'rgba(154,33,67,0.02)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
              transition: 'border-color .15s, background .15s',
            }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: `rgba(154,33,67,0.08)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="14" height="14" fill="none" stroke={CR} strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: CR }}>Add package</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Form bottom sheet ─────────────────────────────── */}
      {isFormOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          {/* Backdrop */}
          <div onClick={closeForm} style={{ position: 'absolute', inset: 0, background: 'rgba(26,13,18,0.55)', backdropFilter: 'blur(2px)' }} />

          {/* Sheet */}
          <div style={{
            position: 'relative', width: '100%', maxWidth: 560, maxHeight: '92svh',
            background: '#fff', borderRadius: '22px 22px 0 0',
            boxShadow: '0 -12px 48px rgba(26,13,18,0.22)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            animation: 'pkgSheet .28s cubic-bezier(0.34,1.56,0.64,1)',
          }}>
            {/* Sheet header */}
            <div style={{
              background: `linear-gradient(135deg, ${CR} 0%, ${CR2} 100%)`,
              padding: '16px 20px', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.5)', letterSpacing: 1, textTransform: 'uppercase', fontWeight: 700 }}>
                  {editingId ? 'Edit' : 'New'} Package
                </p>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#fff', fontFamily: 'Georgia,serif' }}>
                  {editingId ? 'Update details' : 'Build your package'}
                </h3>
              </div>
              <button onClick={closeForm} style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <svg width="13" height="13" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            {/* Scrollable content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 8px' }}>
              {(!vendorId || servicesCatalog.length === 0) ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 0', gap: 10 }}>
                  <Spin />
                  <span style={{ fontSize: 14, color: MUT }}>Loading vendor data…</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

                  {/* Package name */}
                  <div>
                    <label style={{ display: 'block', fontSize: 10.5, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: MUT, marginBottom: 7 }}>Package name</label>
                    <input
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      onFocus={() => setFocusedInput('name')} onBlur={() => setFocusedInput(null)}
                      placeholder="e.g. Premium Full Day"
                      style={inputStyle('name')}
                    />
                  </div>

                  {/* From price */}
                  <div>
                    <label style={{ display: 'block', fontSize: 10.5, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: MUT, marginBottom: 7 }}>From price (R)</label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 15, fontWeight: 700, color: MUT }}>R</span>
                      <input
                        inputMode="numeric" pattern="[0-9]*" placeholder="e.g. 5 000"
                        value={formData.fromPrice}
                        onChange={e => {
                          const raw = String(e.target.value || '');
                          const digits = raw.replace(/\D+/g, '');
                          let norm = digits.replace(/^0+(?=\d)/, '');
                          if (norm === '') norm = digits === '' ? '' : '0';
                          if (raw === '') norm = '';
                          setFormData({ ...formData, fromPrice: norm });
                        }}
                        onFocus={() => setFocusedInput('price')} onBlur={() => setFocusedInput(null)}
                        style={{ ...inputStyle('price'), paddingLeft: 32 }}
                      />
                    </div>
                  </div>

                  {/* Pricing mode */}
                  <div>
                    <label style={{ display: 'block', fontSize: 10.5, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: MUT, marginBottom: 10 }}>Pricing type</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                      {PRICING_OPTS.map(opt => {
                        const active = formData.pricingMode === opt.key;
                        return (
                          <button key={opt.key} type="button" onClick={() => handlePricingModeChange(opt.key as PricingMode)}
                            style={{
                              width: '100%', padding: '11px 14px', borderRadius: 12, textAlign: 'left', cursor: 'pointer',
                              border: `1.5px solid ${active ? CR : BOR}`,
                              background: active ? 'rgba(154,33,67,0.05)' : '#fff',
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              transition: 'all .13s',
                            }}>
                            <div>
                              <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: active ? CR : DK }}>{opt.label}</p>
                              <p style={{ margin: '1px 0 0', fontSize: 11, color: MUT }}>{opt.hint}</p>
                            </div>
                            <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${active ? CR : BOR}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              {active && <div style={{ width: 9, height: 9, borderRadius: '50%', background: CR }} />}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Guest range */}
                    {formData.pricingMode === 'guest-based' && (
                      <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div>
                          <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: MUT, marginBottom: 6 }}>Min guests</label>
                          <input type="number" min={0} value={guestMinRaw}
                            onFocus={() => setFocusedInput('gMin')} onBlur={() => setFocusedInput(null)}
                            onChange={e => {
                              const digits = e.target.value.replace(/\D+/g, '');
                              const norm = digits.replace(/^0+(?=\d)/, '');
                              setGuestMinRaw(norm);
                              const newMin = norm === '' ? 0 : Number(norm);
                              setFormData({ ...formData, guestRange: { ...(formData.guestRange || { min:0, max:0 }), min: newMin } });
                              if (newMin <= 0) setFormErrors(f => ({ ...f, guestRange: 'Min must be > 0' }));
                              else if ((formData.guestRange?.max || 0) && newMin > (formData.guestRange?.max || 0)) setFormErrors(f => ({ ...f, guestRange: 'Min must be ≤ Max' }));
                              else setFormErrors(f => ({ ...f, guestRange: undefined }));
                            }}
                            style={inputStyle('gMin', formErrors.guestRange)}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: MUT, marginBottom: 6 }}>Max guests</label>
                          <input type="number" min={0} value={guestMaxRaw}
                            onFocus={() => setFocusedInput('gMax')} onBlur={() => setFocusedInput(null)}
                            onChange={e => {
                              const digits = e.target.value.replace(/\D+/g, '');
                              const norm = digits.replace(/^0+(?=\d)/, '');
                              setGuestMaxRaw(norm);
                              const newMax = norm === '' ? 0 : Number(norm);
                              setFormData({ ...formData, guestRange: { ...(formData.guestRange || { min:0, max:0 }), max: newMax } });
                              if (newMax <= 0) setFormErrors(f => ({ ...f, guestRange: 'Max must be > 0' }));
                              else if ((formData.guestRange?.min || 0) && (formData.guestRange?.min || 0) > newMax) setFormErrors(f => ({ ...f, guestRange: 'Max must be ≥ Min' }));
                              else setFormErrors(f => ({ ...f, guestRange: undefined }));
                            }}
                            style={inputStyle('gMax', formErrors.guestRange)}
                          />
                        </div>
                        {formErrors.guestRange && <p style={{ gridColumn: '1/-1', margin: 0, fontSize: 12, color: '#c0392b' }}>{formErrors.guestRange}</p>}
                      </div>
                    )}

                    {/* Hours */}
                    {formData.pricingMode === 'time-based' && (
                      <div style={{ marginTop: 12 }}>
                        <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: MUT, marginBottom: 6 }}>Hours coverage</label>
                        <input inputMode="numeric" pattern="[0-9]*" min={0} value={hoursRaw}
                          onFocus={() => setFocusedInput('hours')} onBlur={() => setFocusedInput(null)}
                          onChange={e => {
                            const digits = e.target.value.replace(/\D+/g, '');
                            const norm = digits.replace(/^0+(?=\d)/, '');
                            setHoursRaw(norm);
                            const h = norm === '' ? 0 : Number(norm);
                            setFormData({ ...formData, hours: h });
                            if (h <= 0) setFormErrors(f => ({ ...f, hours: 'Hours must be > 0' }));
                            else setFormErrors(f => ({ ...f, hours: undefined }));
                          }}
                          style={inputStyle('hours', formErrors.hours)}
                        />
                        {formErrors.hours && <p style={{ margin: '5px 0 0', fontSize: 12, color: '#c0392b' }}>{formErrors.hours}</p>}
                      </div>
                    )}
                  </div>

                  {/* Services */}
                  <div>
                    <label style={{ display: 'block', fontSize: 10.5, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: MUT, marginBottom: 10 }}>Included services</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                      {availableServices.map(s => {
                        const sel = formData.includedServices.includes(s);
                        return (
                          <button key={s} type="button" className="pkg-svc-btn" onClick={() => setFormData({ ...formData, includedServices: sel ? formData.includedServices.filter(x => x !== s) : [...formData.includedServices, s] })}
                            style={{
                              padding: '6px 13px', borderRadius: 20, border: `1.5px solid ${sel ? CR : BOR}`,
                              background: sel ? `rgba(154,33,67,0.07)` : '#fff',
                              fontSize: 12.5, fontWeight: 700, color: sel ? CR : MID,
                              boxShadow: sel ? `0 0 0 2px rgba(154,33,67,0.08)` : 'none',
                            }}>
                            {sel && '✓ '}{s}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Most popular toggle */}
                  <button type="button" onClick={() => setFormData({ ...formData, isPopular: !formData.isPopular })} style={{
                    width: '100%', padding: '13px 16px', borderRadius: 13, cursor: 'pointer',
                    border: `1.5px solid ${formData.isPopular ? GD : BOR}`,
                    background: formData.isPopular ? 'rgba(189,152,63,0.07)' : '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    transition: 'all .13s',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 18 }}>★</span>
                      <div style={{ textAlign: 'left' }}>
                        <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: formData.isPopular ? GD2 : DK }}>Mark as most popular</p>
                        <p style={{ margin: 0, fontSize: 11, color: MUT }}>Highlights this package to couples</p>
                      </div>
                    </div>
                    <div style={{ width: 38, height: 22, borderRadius: 11, background: formData.isPopular ? GD : BOR, position: 'relative', transition: 'background .15s', flexShrink: 0 }}>
                      <div style={{ position: 'absolute', top: 3, left: formData.isPopular ? 19 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.2)', transition: 'left .15s' }} />
                    </div>
                  </button>

                </div>
              )}
            </div>

            {/* Footer actions */}
            <div style={{ padding: '14px 20px calc(14px + env(safe-area-inset-bottom))', borderTop: `1px solid ${BOR}`, display: 'flex', gap: 10, flexShrink: 0, background: '#fff' }}>
              {editingId && (
                <button onClick={deletePackage} disabled={saving} style={{
                  padding: '12px 16px', borderRadius: 12, border: `1.5px solid rgba(192,57,43,0.25)`,
                  background: 'rgba(192,57,43,0.06)', color: '#c0392b', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  {saving ? <Spin size={15} color="#c0392b" /> : null}
                  Delete
                </button>
              )}
              <button onClick={closeForm} style={{ padding: '12px 16px', borderRadius: 12, border: `1.5px solid ${BOR}`, background: '#fff', color: DK, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={savePackage} disabled={saving || !formValid} style={{
                flex: 1, padding: '12px', borderRadius: 12, border: 'none',
                background: saving || !formValid ? 'rgba(154,33,67,0.25)' : `linear-gradient(135deg,${CR},${CR2})`,
                color: '#fff', fontSize: 14, fontWeight: 800, cursor: saving || !formValid ? 'default' : 'pointer',
                boxShadow: saving || !formValid ? 'none' : '0 3px 14px rgba(154,33,67,0.28)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'all .14s',
              }}>
                {saving ? <Spin size={16} color="#fff" /> : null}
                {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add package'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bottom navigation bar ─────────────────────────── */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: `1px solid ${BOR}`, padding: 'calc(14px) 16px calc(14px + env(safe-area-inset-bottom))', zIndex: 40, boxShadow: '0 -4px 20px rgba(26,13,18,0.06)' }}>
        <div style={{ maxWidth: 560, margin: '0 auto', display: 'flex', gap: 10 }}>
          <Link href={`/vendor/services${modeQuery}`} style={{ flex: 1, padding: '13px', borderRadius: 13, border: `1.5px solid ${BOR}`, background: '#fff', color: DK, fontSize: 14, fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            ← Back
          </Link>
          <Link
            href={editMode ? '/vendor/dashboard' : `/vendor/media${modeQuery}`}
            onClick={e => { if (!canContinue) e.preventDefault(); }}
            style={{
              flex: 2, padding: '13px', borderRadius: 13, border: 'none', textDecoration: 'none',
              background: canContinue ? `linear-gradient(135deg,${CR},${CR2})` : 'rgba(154,33,67,0.2)',
              color: '#fff', fontSize: 14, fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: canContinue ? '0 4px 16px rgba(154,33,67,0.28)' : 'none',
              pointerEvents: canContinue ? 'auto' : 'none', cursor: canContinue ? 'pointer' : 'default',
              transition: 'all .14s',
            }}>
            {editMode ? 'Save & exit' : 'Continue →'}
          </Link>
        </div>
      </div>
    </div>
  );
}
