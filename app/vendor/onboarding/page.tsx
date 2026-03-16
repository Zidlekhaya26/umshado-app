'use client';

import { useState, useEffect } from 'react';
import { getUserOrRedirect, upsertVendor } from '@/lib/onboarding';
import { useRouter } from 'next/navigation';
import { LOCKED_CATEGORIES } from '@/lib/marketplaceCategories';
import ProfileCompletionIndicator from '@/components/ProfileCompletionIndicator';
import VendorOnboardingProgress from '@/components/VendorOnboardingProgress';
import CurrencySelector from '@/components/CurrencySelector';
import { useCurrency } from '@/app/providers/CurrencyProvider';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/ToastProvider';

const CR='#9A2143',CR2='#731832',CRX='#4d0f21',DK='#1a0d12',BG='#faf8f5',MUT='#7a5060',BOR='#e8d5d0';

function ICS(f:boolean):React.CSSProperties{return{width:'100%',padding:'13px 16px',borderRadius:12,outline:'none',boxSizing:'border-box',border:`1.5px solid ${f?CR:BOR}`,background:'#fff',fontSize:14,color:DK,fontFamily:'inherit',boxShadow:f?`0 0 0 3px rgba(154,33,67,0.09)`:'none',transition:'border-color .14s,box-shadow .14s'};}
function FL({l,req}:{l:string;req?:boolean}){return <label style={{display:'block',fontSize:10.5,fontWeight:800,letterSpacing:1.1,textTransform:'uppercase',color:MUT,marginBottom:7}}>{l}{req&&<span style={{color:CR,marginLeft:3}}>*</span>}</label>;}

export default function VendorOnboarding(){
  const router=useRouter();
  const {currency}=useCurrency();
  const {show:toast}=useToast();
  const [loading,setLoading]=useState(true);
  const [submitting,setSubmitting]=useState(false);
  const [focused,setFocused]=useState('');
  const [fd,setFd]=useState({businessName:'',category:'',city:'',country:'',businessDescription:''});

  useEffect(()=>{
    (async()=>{
      try{
        const user=await getUserOrRedirect();
        if(!user){setLoading(false);return;}
        const {data}=await supabase.from('vendors').select('business_name,category,location,description').eq('user_id',user.id).limit(1).maybeSingle();
        if(data){
          const [city='',country='']=(data.location||'').split(', ');
          setFd({businessName:data.business_name||'',category:data.category||'',city,country,businessDescription:data.description||''});
        }
      }catch{/*ok*/}finally{setLoading(false);}
    })();
  },[]);

  const handleSubmit=async(e:React.FormEvent)=>{
    e.preventDefault();setSubmitting(true);
    try{
      const user=await getUserOrRedirect();
      if(!user){toast('Please sign in to continue.','error');router.push('/auth/sign-in');return;}
      const location=[fd.city,fd.country].filter(Boolean).join(', ')||null;
      const res=await upsertVendor(user.id,{business_name:fd.businessName||null,category:fd.category||null,location,description:fd.businessDescription||null,currency});
      if(!res.success){toast('Could not save your profile. Please try again.','error');setSubmitting(false);return;}
      router.push('/vendor/services?mode=onboarding');
    }catch{toast('Something went wrong. Please try again.','error');setSubmitting(false);}
  };

  if(loading)return(
    <div style={{minHeight:'100svh',display:'flex',alignItems:'center',justifyContent:'center',background:BG}}>
      <div style={{width:38,height:38,border:`3px solid rgba(154,33,67,0.1)`,borderTopColor:CR,borderRadius:'50%',animation:'obs .8s linear infinite'}}/>
      <style>{'@keyframes obs{to{transform:rotate(360deg)}}'}</style>
    </div>
  );

  const dLen=fd.businessDescription.length;

  return(
    <div style={{minHeight:'100svh',background:BG,fontFamily:"'DM Sans',system-ui,sans-serif"}}>
      <style>{`
        @keyframes obs{to{transform:rotate(360deg)}}
        @keyframes obU{from{opacity:0;transform:translateY(11px)}to{opacity:1;transform:translateY(0)}}
        .obU1{animation:obU .4s ease .05s both}.obU2{animation:obU .4s ease .10s both}
        .obU3{animation:obU .4s ease .15s both}.obU4{animation:obU .4s ease .20s both}
        .obU5{animation:obU .4s ease .25s both}
        input,select,textarea,button{font-family:inherit!important}
        .ob-cta:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 8px 28px rgba(154,33,67,0.38)!important}
        .ob-cta{transition:all .15s}
      `}</style>
      <ProfileCompletionIndicator/>

      {/* Header */}
      <div style={{background:`linear-gradient(160deg,${CRX} 0%,${CR} 52%,#c03050 100%)`,position:'relative',overflow:'hidden'}}>
        <div style={{position:'absolute',top:-50,right:-50,width:200,height:200,borderRadius:'50%',border:'1.5px solid rgba(189,152,63,0.1)',pointerEvents:'none'}}/>
        <div style={{position:'absolute',top:-26,right:-26,width:115,height:115,borderRadius:'50%',border:'1.5px solid rgba(189,152,63,0.17)',pointerEvents:'none'}}/>
        <div style={{position:'relative',padding:'22px 20px 0',display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
          <div>
            <p style={{margin:'0 0 3px',fontSize:10,fontWeight:800,color:'rgba(255,255,255,0.4)',letterSpacing:1.5,textTransform:'uppercase'}}>Step 1 of 5</p>
            <h1 style={{margin:'0 0 3px',fontSize:22,fontWeight:800,color:'#fff',fontFamily:'Georgia,serif',letterSpacing:-.3}}>Your business</h1>
            <p style={{margin:0,fontSize:13,color:'rgba(255,255,255,0.5)'}}>Tell couples who you are</p>
          </div>
          <div style={{flexShrink:0}}><CurrencySelector/></div>
        </div>
        <div style={{height:18}}/>
        <VendorOnboardingProgress step={1}/>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} style={{maxWidth:640,margin:'0 auto',padding:'22px 16px calc(100px + env(safe-area-inset-bottom))',display:'flex',flexDirection:'column',gap:18}}>

        <div className="obU1">
          <FL l="Business name" req/>
          <input type="text" value={fd.businessName} required placeholder="e.g. Luminary Photography"
            onFocus={()=>setFocused('n')} onBlur={()=>setFocused('')}
            onChange={e=>setFd({...fd,businessName:e.target.value})} style={ICS(focused==='n')}/>
        </div>

        <div className="obU2">
          <FL l="Vendor category" req/>
          <div style={{position:'relative'}}>
            <select value={fd.category} required
              onFocus={()=>setFocused('c')} onBlur={()=>setFocused('')}
              onChange={e=>setFd({...fd,category:e.target.value})}
              style={{...ICS(focused==='c'),paddingRight:40,appearance:'none',cursor:'pointer',color:fd.category?DK:MUT}}>
              <option value="" disabled>Select a category</option>
              {[...LOCKED_CATEGORIES].map(c=><option key={c} value={c}>{c}</option>)}
            </select>
            <div style={{position:'absolute',right:14,top:'50%',transform:'translateY(-50%)',pointerEvents:'none',color:MUT}}>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
            </div>
          </div>
        </div>

        <div className="obU3" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <div>
            <FL l="City" req/>
            <input type="text" value={fd.city} required placeholder="e.g. Cape Town"
              onFocus={()=>setFocused('ci')} onBlur={()=>setFocused('')}
              onChange={e=>setFd({...fd,city:e.target.value})} style={ICS(focused==='ci')}/>
          </div>
          <div>
            <FL l="Country" req/>
            <input type="text" value={fd.country} required placeholder="South Africa"
              onFocus={()=>setFocused('co')} onBlur={()=>setFocused('')}
              onChange={e=>setFd({...fd,country:e.target.value})} style={ICS(focused==='co')}/>
          </div>
        </div>

        <div className="obU4">
          <FL l="Business description" req/>
          <div style={{position:'relative'}}>
            <textarea value={fd.businessDescription} required rows={5}
              placeholder="Tell couples about your services, experience, and what makes your business special for South African weddings…"
              onFocus={()=>setFocused('d')} onBlur={()=>setFocused('')}
              onChange={e=>setFd({...fd,businessDescription:e.target.value})}
              style={{...ICS(focused==='d'),padding:'13px 16px 32px',resize:'none'}}/>
            <div style={{position:'absolute',bottom:10,right:12,fontSize:10.5,fontWeight:700,color:dLen>=120?'#1e7a4e':MUT}}>
              {dLen<120?`${120-dLen} more chars`:`✓ ${dLen} chars`}
            </div>
          </div>
          <p style={{margin:'5px 0 0',fontSize:11.5,color:MUT}}>Highlight your style, expertise, and cultural experience.</p>
        </div>

        <div className="obU5" style={{padding:'14px 16px',borderRadius:14,background:'rgba(154,33,67,0.05)',border:'1.5px solid rgba(154,33,67,0.12)',display:'flex',gap:12}}>
          <span style={{fontSize:18,flexShrink:0}}>💡</span>
          <div>
            <p style={{margin:'0 0 2px',fontSize:13,fontWeight:700,color:CR}}>Next up: Services</p>
            <p style={{margin:0,fontSize:12.5,color:MUT,lineHeight:1.55}}>After this you'll select services, build packages, add photos, and publish — about 5 minutes total.</p>
          </div>
        </div>

        <p style={{margin:0,fontSize:11.5,color:MUT,textAlign:'center',lineHeight:1.6}}>
          By continuing, you confirm all information relates to your legitimate wedding business.
        </p>
      </form>

      {/* Bottom bar */}
      <div style={{position:'fixed',bottom:0,left:0,right:0,background:'#fff',borderTop:`1px solid ${BOR}`,padding:'14px 16px calc(14px + env(safe-area-inset-bottom))',zIndex:40,boxShadow:'0 -4px 20px rgba(26,13,18,0.06)'}}>
        <div style={{maxWidth:640,margin:'0 auto'}}>
          <button type="submit" onClick={handleSubmit} disabled={submitting} className="ob-cta"
            style={{width:'100%',padding:'14px',borderRadius:13,border:'none',background:`linear-gradient(135deg,${CR},${CR2})`,color:'#fff',fontSize:15,fontWeight:800,cursor:submitting?'default':'pointer',boxShadow:'0 4px 18px rgba(154,33,67,0.28)',opacity:submitting?.7:1,display:'flex',alignItems:'center',justifyContent:'center',gap:9,fontFamily:'inherit'}}>
            {submitting&&<div style={{width:16,height:16,border:'2px solid rgba(255,255,255,.3)',borderTopColor:'#fff',borderRadius:'50%',animation:'obs .8s linear infinite'}}/>}
            {submitting?'Saving…':'Save & Continue →'}
          </button>
        </div>
      </div>
    </div>
  );
}
