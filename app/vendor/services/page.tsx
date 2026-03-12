"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import {
  getOrCreateVendorForUser, getServicesCatalog, getVendorSelectedServices,
  saveVendorServices, groupServicesByCategory, type Service,
} from '@/lib/vendorServices';
import { LOCKED_CATEGORIES, LOCKED_CATEGORY_SET } from '@/lib/marketplaceCategories';
import ServicePicker from '@/components/ServicePicker';
import ProfileCompletionIndicator from '@/components/ProfileCompletionIndicator';
import VendorOnboardingProgress from '@/components/VendorOnboardingProgress';
import { getVendorSetupStatus } from '@/lib/vendorOnboarding';

const CR='#9A2143',CR2='#731832',CRX='#4d0f21',GD='#BD983F',DK='#1a0d12',BG='#faf8f5',MUT='#7a5060',BOR='#e8d5d0';

export default function VendorServices(){
  const [services,setServices]=useState<Service[]>([]);
  const [selectedServiceIds,setSelectedServiceIds]=useState<string[]>([]);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [saved,setSaved]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [vendorId,setVendorId]=useState<string|null>(null);
  const [vendorCategory,setVendorCategory]=useState('');
  const [isPublished,setIsPublished]=useState(false);
  const [onboardingCompleted,setOnboardingCompleted]=useState(false);
  const [forcedEdit,setForcedEdit]=useState(false);
  const [needsOnboarding,setNeedsOnboarding]=useState<boolean|null>(null);

  useEffect(()=>{loadData();},[]);
  useEffect(()=>{
    if(typeof window!=='undefined')setForcedEdit(new URLSearchParams(window.location.search).get('mode')==='edit');
  },[]);

  const loadData=async()=>{
    try{
      setLoading(true);setError(null);
      const vId=await getOrCreateVendorForUser();
      if(!vId){setError('No active session. Please sign in.');setLoading(false);return;}
      setVendorId(vId);
      try{
        const {data:vr}=await supabase.from('vendors').select('category,is_published,onboarding_completed').eq('id',vId).maybeSingle();
        if(vr){
          if(vr.category)setVendorCategory(vr.category);
          if(typeof vr.is_published==='boolean')setIsPublished(Boolean(vr.is_published));
          if(typeof vr.onboarding_completed==='boolean')setOnboardingCompleted(Boolean(vr.onboarding_completed));
        }
      }catch{/*ok*/}
      try{const s=await getVendorSetupStatus(supabase,vId);setNeedsOnboarding(Boolean(s.needsOnboarding));}catch{/*ok*/}
      const [catalog,selections]=await Promise.all([getServicesCatalog(),getVendorSelectedServices(vId)]);
      setServices(catalog);setSelectedServiceIds(selections.selectedServiceIds);
    }catch(err:any){setError(err.message||'Failed to load');}finally{setLoading(false);}
  };

  const handleContinue=async()=>{
    if(!vendorId){setError('No vendor ID');return;}
    try{
      setSaving(true);setError(null);
      const result=await saveVendorServices(vendorId,selectedServiceIds);
      if(!result.success){setError(result.error||'Failed to save');return;}
      const modeOnboarding=typeof window!=='undefined'&&new URLSearchParams(window.location.search).get('mode')==='onboarding';
      const isOnboarding=modeOnboarding||Boolean(needsOnboarding);
      if(isOnboarding){window.location.href='/vendor/packages?mode=onboarding';}
      else{setSaved(true);setTimeout(()=>setSaved(false),2500);}
    }catch(err:any){setError(err.message||'Failed to save');}finally{setSaving(false);}
  };

  const groupedServices=groupServicesByCategory(services);
  const orderedKeys=useMemo(()=>{
    const keys=Object.keys(groupedServices);
    const locked=LOCKED_CATEGORIES.filter(c=>keys.includes(c));
    const unknown=keys.filter(c=>!LOCKED_CATEGORY_SET.has(c)).sort((a,b)=>a.localeCompare(b));
    let ordered=[...locked,...unknown];
    if(vendorCategory&&ordered.includes(vendorCategory))ordered=[vendorCategory,...ordered.filter(c=>c!==vendorCategory)];
    return ordered;
  },[groupedServices,vendorCategory]);

  const showOnlyVendorCategory=Boolean(vendorCategory&&!forcedEdit);
  const displayedKeys=showOnlyVendorCategory?[vendorCategory]:orderedKeys;
  const canContinue=selectedServiceIds.length>0;

  const modeOnboarding=typeof window!=='undefined'&&new URLSearchParams(window.location.search).get('mode')==='onboarding';
  const isOnboarding=modeOnboarding||Boolean(needsOnboarding);
  const editMode=!isOnboarding;
  const backHref=editMode?'/vendor/dashboard':'/vendor/onboarding';

  return(
    <div style={{minHeight:'100svh',background:BG,fontFamily:"'DM Sans',system-ui,sans-serif"}}>
      <style>{`
        @keyframes svspin{to{transform:rotate(360deg)}}
        @keyframes svU{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        .svU1{animation:svU .35s ease .05s both}.svU2{animation:svU .35s ease .10s both}
        button,input,select{font-family:inherit!important}
        .sv-cta:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 8px 28px rgba(154,33,67,0.38)!important}
        .sv-cta{transition:all .15s}
        .sv-back:hover{background:#f5f0ee!important}
      `}</style>
      <ProfileCompletionIndicator/>

      {/* Header */}
      <div style={{background:`linear-gradient(160deg,${CRX} 0%,${CR} 52%,#c03050 100%)`,position:'relative',overflow:'hidden'}}>
        <div style={{position:'absolute',top:-50,right:-50,width:200,height:200,borderRadius:'50%',border:'1.5px solid rgba(189,152,63,0.1)',pointerEvents:'none'}}/>
        <div style={{position:'absolute',top:-26,right:-26,width:115,height:115,borderRadius:'50%',border:'1.5px solid rgba(189,152,63,0.17)',pointerEvents:'none'}}/>
        <div style={{position:'relative',padding:'22px 20px 0'}}>
          <p style={{margin:'0 0 3px',fontSize:10,fontWeight:800,color:'rgba(255,255,255,0.4)',letterSpacing:1.5,textTransform:'uppercase'}}>Step 2 of 5</p>
          <h1 style={{margin:'0 0 3px',fontSize:22,fontWeight:800,color:'#fff',fontFamily:'Georgia,serif',letterSpacing:-.3}}>Your services</h1>
          <p style={{margin:0,fontSize:13,color:'rgba(255,255,255,0.5)'}}>
            Tap <strong style={{color:'rgba(255,255,255,0.75)'}}>+ Add services</strong> for each category, then remove any you don&apos;t offer
          </p>
        </div>
        <div style={{height:18}}/>
        <VendorOnboardingProgress step={2}/>
      </div>

      {/* Body */}
      <div style={{maxWidth:640,margin:'0 auto',padding:'18px 16px calc(110px + env(safe-area-inset-bottom))'}}>

        {loading&&(
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:'56px 0',gap:12}}>
            <div style={{width:28,height:28,border:`3px solid rgba(154,33,67,0.1)`,borderTopColor:CR,borderRadius:'50%',animation:'svspin .8s linear infinite'}}/>
            <span style={{fontSize:14,color:MUT}}>Loading services…</span>
          </div>
        )}

        {!loading&&(
          <div style={{display:'flex',flexDirection:'column',gap:24}}>
            {/* Category filter notice */}
            {showOnlyVendorCategory&&(
              <div style={{padding:'10px 14px',borderRadius:12,background:'rgba(154,33,67,0.05)',border:'1.5px solid rgba(154,33,67,0.12)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <div>
                  <span style={{fontSize:11,fontWeight:800,color:MUT,letterSpacing:.8,textTransform:'uppercase'}}>Showing: </span>
                  <span style={{fontSize:13,fontWeight:700,color:CR}}>{vendorCategory}</span>
                </div>
                <Link href="/vendor/onboarding" style={{fontSize:12,fontWeight:800,color:MUT,textDecoration:'none',background:'rgba(122,80,96,0.08)',padding:'4px 10px',borderRadius:8}}>
                  Change category
                </Link>
              </div>
            )}

            {/* Service picker for each category */}
            {displayedKeys.map(cat=>(
              <div key={cat} className="svU1">
                <h3 style={{margin:'0 0 10px',fontSize:12.5,fontWeight:800,color:MUT,letterSpacing:.8,textTransform:'uppercase'}}>{cat}</h3>
                <ServicePicker
                  category={cat}
                  services={groupedServices[cat]||[]}
                  selectedIds={selectedServiceIds}
                  onChange={setSelectedServiceIds}
                />
              </div>
            ))}

            {/* Error */}
            {error&&<p style={{margin:0,fontSize:13,color:'#c0392b',fontWeight:600}}>{error}</p>}

            {/* Selection count pill */}
            {selectedServiceIds.length>0&&(
              <div className="svU2" style={{padding:'11px 16px',borderRadius:12,background:'rgba(30,122,78,0.07)',border:'1.5px solid rgba(30,122,78,0.2)',display:'flex',alignItems:'center',gap:10}}>
                <svg width="16" height="16" fill="none" stroke="#1e7a4e" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                <span style={{fontSize:13,fontWeight:700,color:'#1e7a4e'}}>{selectedServiceIds.length} service{selectedServiceIds.length!==1?'s':''} selected</span>
                {saved&&<span style={{marginLeft:'auto',fontSize:12,fontWeight:700,color:'#1e7a4e'}}>Saved ✓</span>}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <div style={{position:'fixed',bottom:0,left:0,right:0,background:'#fff',borderTop:`1px solid ${BOR}`,padding:'14px 16px calc(14px + env(safe-area-inset-bottom))',zIndex:40,boxShadow:'0 -4px 20px rgba(26,13,18,0.06)'}}>
        <div style={{maxWidth:640,margin:'0 auto',display:'flex',gap:10}}>
          <Link href={backHref} className="sv-back" style={{flex:1,padding:'13px',borderRadius:13,border:`1.5px solid ${BOR}`,background:'#fff',color:DK,fontSize:14,fontWeight:700,textDecoration:'none',display:'flex',alignItems:'center',justifyContent:'center',transition:'background .14s'}}>
            ← Back
          </Link>
          <button onClick={handleContinue} disabled={!canContinue||saving} className="sv-cta"
            style={{flex:2,padding:'13px',borderRadius:13,border:'none',background:canContinue?`linear-gradient(135deg,${CR},${CR2})`:'rgba(154,33,67,0.2)',color:'#fff',fontSize:14,fontWeight:800,cursor:canContinue&&!saving?'pointer':'default',boxShadow:canContinue?'0 4px 18px rgba(154,33,67,0.28)':'none',display:'flex',alignItems:'center',justifyContent:'center',gap:9,fontFamily:'inherit'}}>
            {saving&&<div style={{width:16,height:16,border:'2px solid rgba(255,255,255,.3)',borderTopColor:'#fff',borderRadius:'50%',animation:'svspin .8s linear infinite'}}/>}
            {saving?'Saving…':isOnboarding?'Save & Continue →':'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
