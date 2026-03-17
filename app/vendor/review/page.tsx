'use client';

import { useState, useEffect, useMemo } from 'react';
import ImageLightbox from '@/components/ui/ImageLightbox';
import { supabase } from '@/lib/supabaseClient';
import { useCurrency } from '@/app/providers/CurrencyProvider';
import { getVendorSetupStatus } from '@/lib/vendorOnboarding';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import ProfileCompletionIndicator from '@/components/ProfileCompletionIndicator';
import VendorOnboardingProgress from '@/components/VendorOnboardingProgress';
import { CR, CR2, CRX, GD2, DK, MUT, BOR, BG } from '@/lib/tokens';
import { LoadingPage } from '@/components/ui/UmshadoLogo';


interface VendorRow{id:string;business_name:string|null;category:string|null;location:string|null;description:string|null;logo_url:string|null;cover_url:string|null;portfolio_urls:string[]|null;social_links:Record<string,string>|null;contact:{whatsapp?:string;phone?:string;preferredContact?:string}|null;is_published:boolean;}
interface PkgRow{id:string;name:string;base_price:number;pricing_mode:string;base_guests:number|null;base_hours:number|null;included_services:string[]|null;is_popular:boolean;}

const PL:Record<string,string>={guest:'Guest-based',time:'Time-based','per-person':'Per person',package:'Fixed package',event:'Flat event rate',quantity:'Quantity-based'};
function pricingLabel(mode:string,guests:number|null,hours:number|null){
  if(mode==='guest'&&guests!=null)return`${guests}+ guests`;
  if(mode==='time'&&hours!=null)return`${hours} hours`;
  return PL[mode]||mode;
}
function extractYouTubeId(url:string):string|null{
  const ps=[/(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,/(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,/(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,/(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/];
  for(const p of ps){const m=url.match(p);if(m)return m[1];}return null;
}

function CheckRow({ok,label,href}:{ok:boolean;label:string;href:string}){
  return(
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',borderRadius:12,background:ok?'rgba(30,122,78,0.05)':'rgba(154,33,67,0.04)',border:`1.5px solid ${ok?'rgba(30,122,78,0.15)':'rgba(154,33,67,0.1)'}`}}>
      <div style={{display:'flex',alignItems:'center',gap:10}}>
        {ok
          ?<svg width="16" height="16" fill="none" stroke="#1e7a4e" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          :<svg width="16" height="16" fill="none" stroke={CR} strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01"/></svg>
        }
        <span style={{fontSize:13.5,fontWeight:700,color:ok?'#1e7a4e':DK}}>{label}</span>
      </div>
      {!ok&&<Link href={href} style={{fontSize:12,fontWeight:800,color:CR,textDecoration:'none',padding:'4px 10px',background:'rgba(154,33,67,0.08)',borderRadius:8}}>Add →</Link>}
    </div>
  );
}

function SectionCard({title,editHref,actionQuery,children}:{title:string;editHref:string;actionQuery:string;children:React.ReactNode}){
  return(
    <div style={{background:'#fff',borderRadius:18,border:`1.5px solid ${BOR}`,overflow:'hidden',boxShadow:'0 2px 10px rgba(26,13,18,0.05)'}}>
      <div style={{padding:'14px 16px',borderBottom:`1px solid ${BOR}`,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <h3 style={{margin:0,fontSize:13,fontWeight:800,color:DK,letterSpacing:.2}}>{title}</h3>
        <Link href={editHref+actionQuery} style={{fontSize:12,fontWeight:800,color:CR,textDecoration:'none',padding:'5px 12px',background:'rgba(154,33,67,0.06)',border:`1px solid rgba(154,33,67,0.15)`,borderRadius:20}}>
          Edit
        </Link>
      </div>
      <div style={{padding:'14px 16px'}}>{children}</div>
    </div>
  );
}

export default function VendorReview(){
  const router=useRouter();
  const {format}=useCurrency();
  const [loading,setLoading]=useState(true);
  const [isPublishing,setIsPublishing]=useState(false);
  const [vendorId,setVendorId]=useState<string|null>(null);
  const [userEmail,setUserEmail]=useState<string|null>(null);
  const [vendor,setVendor]=useState<VendorRow|null>(null);
  const [services,setServices]=useState<string[]>([]);
  const [packages,setPackages]=useState<PkgRow[]>([]);
  const [forcedEdit,setForcedEdit]=useState(false);
  const [logoOpen,setLogoOpen]=useState(false);

  useEffect(()=>{
    (async()=>{
      try{
        const {data:ud}=await supabase.auth.getUser();
        const user=(ud as any)?.user;
        if(!user){setLoading(false);return;}
        setUserEmail(user.email||null);
        const cols='id,business_name,category,location,description,logo_url,cover_url,portfolio_urls,social_links,contact,is_published,onboarding_completed';
        let v:VendorRow|null=null;
        const {data:v1}=await supabase.from('vendors').select(cols).eq('user_id',user.id).order('created_at',{ascending:false}).limit(1).maybeSingle();
        if(v1)v=v1 as unknown as VendorRow;
        else{const {data:v2}=await supabase.from('vendors').select(cols).eq('id',user.id).maybeSingle();if(v2)v=v2 as unknown as VendorRow;}
        if(!v){setLoading(false);return;}
        setVendorId(v.id);setVendor(v);
        try{const s=await getVendorSetupStatus(supabase,v.id);(window as any).__rvNeedsOnboarding=s.needsOnboarding;}catch{/*ok*/}
        const {data:vsData}=await supabase.from('vendor_services').select('service_id,custom_name,services:service_id(name)').eq('vendor_id',v.id);
        if(vsData)setServices(vsData.map((vs:any)=>vs.custom_name||vs.services?.name||null).filter(Boolean));
        const {data:pkgData}=await supabase.from('vendor_packages').select('id,name,base_price,pricing_mode,base_guests,base_hours,included_services,is_popular').eq('vendor_id',v.id).order('base_price',{ascending:true});
        if(pkgData)setPackages(pkgData as PkgRow[]);
      }catch(err){console.error('Error loading review:',err);}finally{setLoading(false);}
    })();
  },[]);

  useEffect(()=>{if(typeof window!=='undefined')setForcedEdit(new URLSearchParams(window.location.search).get('mode')==='edit');},[]);

  const socialLinks=vendor?.social_links||{};
  const contact=vendor?.contact||{};
  const portfolioUrls=vendor?.portfolio_urls||[];
  const videoUrl=socialLinks.youtube||'';
  const ytId=videoUrl?extractYouTubeId(videoUrl):null;

  const socialEntries=useMemo(()=>{
    const labels:Record<string,string>={instagram:'Instagram',facebook:'Facebook',tiktok:'TikTok',website:'Website'};
    return Object.entries(socialLinks).filter(([k,v])=>k!=='youtube'&&v).map(([k,v])=>({key:k,label:labels[k]||k,url:v}));
  },[socialLinks]);

  const hasContact=!!(contact.whatsapp||contact.phone||userEmail);
  const hasMedia=!!(vendor?.logo_url||vendor?.cover_url||portfolioUrls.length>0);
  const checks={businessName:!!vendor?.business_name,services:services.length>0,packages:packages.length>=1,media:hasMedia,contact:hasContact};
  const isComplete=Object.values(checks).every(Boolean);

  const modeOnboarding=typeof window!=='undefined'&&new URLSearchParams(window.location.search).get('mode')==='onboarding';
  const needsOnboarding=typeof window!=='undefined'?Boolean((window as any).__rvNeedsOnboarding):false;
  const isOnboarding=modeOnboarding||needsOnboarding;
  const editMode=Boolean((!isOnboarding&&forcedEdit)||vendor?.is_published||(vendor as any)?.onboarding_completed);
  const actionQuery=isOnboarding?'?mode=onboarding':'?mode=edit';

  const handlePublish=async()=>{
    if(!vendorId)return;
    setIsPublishing(true);
    try{
      const {data:{session}}=await supabase.auth.getSession();
      if(!session){alert('Please sign in to publish.');return;}
      const {error}=await supabase.from('vendors').update({is_published:true,onboarding_completed:true}).eq('id',vendorId);
      if(error){console.error('Publish error:',error);alert('Failed to publish. Please try again.');return;}
      alert('Congratulations! Your vendor profile has been published!');
      router.push('/vendor/dashboard');
    }catch(err){console.error('Publish error:',err);alert('Failed to publish. Please try again.');}finally{setIsPublishing(false);}
  };

  if(loading)return <LoadingPage />;

  return(
    <div style={{minHeight:'100svh',background:BG,fontFamily:"'DM Sans',system-ui,sans-serif"}}>
      <style>{`
        @keyframes rvspin{to{transform:rotate(360deg)}}
        @keyframes rvU{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        .rvU1{animation:rvU .38s ease .05s both}.rvU2{animation:rvU .38s ease .10s both}
        .rvU3{animation:rvU .38s ease .15s both}.rvU4{animation:rvU .38s ease .20s both}
        .rvU5{animation:rvU .38s ease .25s both}.rvU6{animation:rvU .38s ease .30s both}
        button,a{font-family:inherit!important}
        .rv-pub:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 8px 28px rgba(154,33,67,0.42)!important}
        .rv-pub{transition:all .15s}
        .rv-back:hover{background:#f5f0ee!important}
      `}</style>
      <ProfileCompletionIndicator/>

      {/* Header */}
      <div style={{background:`linear-gradient(160deg,${CRX} 0%,${CR} 52%,#c03050 100%)`,position:'relative',overflow:'hidden'}}>
        <div style={{position:'absolute',top:-50,right:-50,width:200,height:200,borderRadius:'50%',border:'1.5px solid rgba(189,152,63,0.1)',pointerEvents:'none'}}/>
        <div style={{position:'absolute',top:-26,right:-26,width:115,height:115,borderRadius:'50%',border:'1.5px solid rgba(189,152,63,0.17)',pointerEvents:'none'}}/>
        <div style={{position:'relative',padding:'22px 20px 0'}}>
          <p style={{margin:'0 0 3px',fontSize:10,fontWeight:800,color:'rgba(255,255,255,0.4)',letterSpacing:1.5,textTransform:'uppercase'}}>Step 5 of 5</p>
          <h1 style={{margin:'0 0 3px',fontSize:22,fontWeight:800,color:'#fff',fontFamily:'Georgia,serif',letterSpacing:-.3}}>Review & publish</h1>
          <p style={{margin:0,fontSize:13,color:'rgba(255,255,255,0.5)'}}>Check everything looks great before going live</p>
        </div>
        <div style={{height:18}}/>
        <VendorOnboardingProgress step={5}/>
      </div>

      {/* Body */}
      <div style={{maxWidth:640,margin:'0 auto',padding:'20px 16px calc(110px + env(safe-area-inset-bottom))',display:'flex',flexDirection:'column',gap:16}}>

        {/* Status banner */}
        <div className="rvU1" style={{padding:'14px 16px',borderRadius:14,background:vendor?.is_published?'rgba(30,122,78,0.08)':isComplete?'rgba(30,122,78,0.08)':'rgba(189,152,63,0.09)',border:`1.5px solid ${vendor?.is_published?'rgba(30,122,78,0.2)':isComplete?'rgba(30,122,78,0.2)':'rgba(189,152,63,0.25)'}`,display:'flex',alignItems:'flex-start',gap:12}}>
          <span style={{fontSize:20,flexShrink:0}}>{vendor?.is_published?'✅':isComplete?'🚀':'📋'}</span>
          <div>
            <p style={{margin:'0 0 2px',fontSize:14,fontWeight:800,color:vendor?.is_published?'#1e7a4e':isComplete?'#1e7a4e':GD2}}>
              {vendor?.is_published?'Profile is live!':isComplete?'Ready to publish!':'Complete these sections:'}
            </p>
            <p style={{margin:0,fontSize:12.5,color:MUT,lineHeight:1.5}}>
              {vendor?.is_published?'Couples can find you on the uMshado marketplace.':isComplete?'Your profile looks great. Hit publish to go live.':'Complete all sections below to publish your profile.'}
            </p>
          </div>
        </div>

        {/* Checklist */}
        <div className="rvU2" style={{display:'flex',flexDirection:'column',gap:8}}>
          <p style={{margin:'0 0 6px',fontSize:10.5,fontWeight:800,color:MUT,letterSpacing:1,textTransform:'uppercase'}}>Profile checklist</p>
          <CheckRow ok={checks.businessName} label="Business profile" href={`/vendor/onboarding`}/>
          <CheckRow ok={checks.services}     label="Services selected" href={`/vendor/services`}/>
          <CheckRow ok={checks.packages}     label="At least 1 package" href={`/vendor/packages`}/>
          <CheckRow ok={checks.media}        label="Media & photos" href={`/vendor/media`}/>
          <CheckRow ok={checks.contact}      label="Contact details" href={`/vendor/media`}/>
        </div>

        {/* Business info */}
        {vendor&&(
          <div className="rvU3">
            <SectionCard title="Business profile" editHref="/vendor/onboarding" actionQuery="">
              <div style={{display:'flex',gap:14,alignItems:'flex-start'}}>
                {vendor.logo_url&&(
                  <button onClick={()=>setLogoOpen(true)} style={{width:56,height:56,borderRadius:12,overflow:'hidden',border:`1.5px solid ${BOR}`,background:'#fff',padding:0,cursor:'pointer',flexShrink:0,position:'relative'}}>
                    <Image src={vendor.logo_url} alt="Logo" fill sizes="56px" style={{objectFit:'contain',padding:4}}/>
                  </button>
                )}
                <div style={{flex:1,minWidth:0}}>
                  <p style={{margin:'0 0 2px',fontSize:15,fontWeight:800,color:DK}}>{vendor.business_name||'—'}</p>
                  <p style={{margin:'0 0 2px',fontSize:12.5,fontWeight:600,color:CR}}>{vendor.category||'No category'}</p>
                  <p style={{margin:0,fontSize:12,color:MUT}}>{vendor.location||'No location set'}</p>
                </div>
              </div>
              {vendor.description&&<p style={{margin:'12px 0 0',fontSize:13,color:DK,lineHeight:1.6,borderTop:`1px solid ${BOR}`,paddingTop:12}}>{vendor.description.length>200?vendor.description.slice(0,200)+'…':vendor.description}</p>}
            </SectionCard>
          </div>
        )}

        {/* Packages */}
        {packages.length>0&&(
          <div className="rvU4">
            <SectionCard title={`Packages (${packages.length})`} editHref="/vendor/packages" actionQuery={actionQuery}>
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {packages.map(pkg=>(
                  <div key={pkg.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 12px',borderRadius:10,background:'rgba(154,33,67,0.03)',border:`1px solid rgba(154,33,67,0.1)`}}>
                    <div>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <span style={{fontSize:13.5,fontWeight:700,color:DK}}>{pkg.name}</span>
                        {pkg.is_popular&&<span style={{fontSize:9.5,fontWeight:800,color:GD2,background:'rgba(189,152,63,0.12)',padding:'2px 7px',borderRadius:20,letterSpacing:.4}}>POPULAR</span>}
                      </div>
                      <span style={{fontSize:11.5,color:MUT}}>{pricingLabel(pkg.pricing_mode,pkg.base_guests,pkg.base_hours)}</span>
                    </div>
                    <span style={{fontSize:16,fontWeight:800,color:DK,fontFamily:'Georgia,serif'}}>{format(pkg.base_price)}</span>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        )}

        {/* Services */}
        {services.length>0&&(
          <div className="rvU5">
            <SectionCard title={`Services (${services.length})`} editHref="/vendor/services" actionQuery={actionQuery}>
              <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                {services.map(s=><span key={s} style={{padding:'4px 11px',borderRadius:20,background:'rgba(154,33,67,0.06)',border:'1px solid rgba(154,33,67,0.12)',fontSize:12,fontWeight:600,color:CR}}>{s}</span>)}
              </div>
            </SectionCard>
          </div>
        )}

        {/* Portfolio preview */}
        {portfolioUrls.length>0&&(
          <div className="rvU6">
            <SectionCard title={`Portfolio (${portfolioUrls.length} photos)`} editHref="/vendor/media" actionQuery={actionQuery}>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:6}}>
                {portfolioUrls.slice(0,8).map((url,i)=>(
                  <div key={i} style={{aspectRatio:'1',borderRadius:8,overflow:'hidden',border:`1.5px solid ${BOR}`,position:'relative'}}>
                    <Image src={url} alt={`Portfolio ${i+1}`} fill sizes="80px" style={{objectFit:'cover'}}/>
                  </div>
                ))}
              </div>
              {portfolioUrls.length>8&&<p style={{margin:'8px 0 0',fontSize:12,color:MUT}}>+{portfolioUrls.length-8} more photos</p>}
            </SectionCard>
          </div>
        )}

        {/* Social / contact */}
        {(socialEntries.length>0||hasContact)&&(
          <SectionCard title="Social & contact" editHref="/vendor/media" actionQuery={actionQuery}>
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              {socialEntries.map(e=>(
                <div key={e.key} style={{fontSize:13,color:DK,display:'flex',gap:8}}>
                  <span style={{fontWeight:700,color:MUT,minWidth:64,fontSize:12}}>{e.label}</span>
                  <span style={{color:DK,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{e.url}</span>
                </div>
              ))}
              {contact.whatsapp&&<div style={{fontSize:13,color:DK,display:'flex',gap:8}}><span style={{fontWeight:700,color:MUT,minWidth:64,fontSize:12}}>WhatsApp</span>{contact.whatsapp}</div>}
              {contact.phone&&<div style={{fontSize:13,color:DK,display:'flex',gap:8}}><span style={{fontWeight:700,color:MUT,minWidth:64,fontSize:12}}>Phone</span>{contact.phone}</div>}
            </div>
          </SectionCard>
        )}

        {/* Lightbox */}
        <ImageLightbox src={vendor?.logo_url} alt={vendor?.business_name||''} isOpen={logoOpen} onClose={()=>setLogoOpen(false)}/>
      </div>

      {/* Bottom nav */}
      <div style={{position:'fixed',bottom:0,left:0,right:0,background:'#fff',borderTop:`1px solid ${BOR}`,padding:'14px 16px calc(14px + env(safe-area-inset-bottom))',zIndex:40,boxShadow:'0 -4px 20px rgba(26,13,18,0.06)'}}>
        <div style={{maxWidth:640,margin:'0 auto',display:'flex',gap:10}}>
          <Link href={`/vendor/media${actionQuery}`} className="rv-back" style={{flex:1,padding:'13px',borderRadius:13,border:`1.5px solid ${BOR}`,background:'#fff',color:DK,fontSize:14,fontWeight:700,textDecoration:'none',display:'flex',alignItems:'center',justifyContent:'center',transition:'background .14s'}}>
            ← Back
          </Link>
          {vendor?.is_published?(
            <Link href="/vendor/dashboard" style={{flex:2,padding:'13px',borderRadius:13,border:'none',background:`linear-gradient(135deg,#1e7a4e,#155a38)`,color:'#fff',fontSize:14,fontWeight:800,textDecoration:'none',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 4px 18px rgba(30,122,78,0.3)'}}>
              View dashboard →
            </Link>
          ):(
            <button onClick={handlePublish} disabled={isPublishing||!isComplete} className="rv-pub"
              style={{flex:2,padding:'13px',borderRadius:13,border:'none',background:isComplete?`linear-gradient(135deg,${CR},${CR2})`:'rgba(154,33,67,0.2)',color:'#fff',fontSize:14,fontWeight:800,cursor:isComplete&&!isPublishing?'pointer':'default',boxShadow:isComplete?'0 4px 22px rgba(154,33,67,0.32)':'none',display:'flex',alignItems:'center',justifyContent:'center',gap:9,fontFamily:'inherit'}}>
              {isPublishing&&<div style={{width:16,height:16,border:'2px solid rgba(255,255,255,.3)',borderTopColor:'#fff',borderRadius:'50%',animation:'rvspin .8s linear infinite'}}/>}
              {isPublishing?'Publishing…':'🚀 Publish profile'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
