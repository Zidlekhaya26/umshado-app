"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import ProfileCompletionIndicator from '@/components/ProfileCompletionIndicator';
import VendorOnboardingProgress from '@/components/VendorOnboardingProgress';
import { supabase } from '@/lib/supabaseClient';
import { getVendorSetupStatus } from '@/lib/vendorOnboarding';
import { CR, CR2, CRX, DK, MUT, BOR, BG } from '@/lib/tokens';
import { LoadingPage } from '@/components/ui/UmshadoLogo';


type PreferredContact='chat'|'whatsapp'|'call';

function FL({l,opt}:{l:string;opt?:boolean}){
  return <label style={{display:'block',fontSize:10.5,fontWeight:800,letterSpacing:1.1,textTransform:'uppercase',color:MUT,marginBottom:7}}>{l}{opt&&<span style={{fontSize:9.5,fontWeight:600,marginLeft:5,opacity:.65}}>(optional)</span>}</label>;
}

function ICS(f:boolean):React.CSSProperties{
  return {width:'100%',padding:'12px 16px',borderRadius:12,outline:'none',boxSizing:'border-box',border:`1.5px solid ${f?CR:BOR}`,background:'#fff',fontSize:14,color:DK,fontFamily:'inherit',boxShadow:f?`0 0 0 3px rgba(154,33,67,0.09)`:'none',transition:'border-color .14s,box-shadow .14s'};
}

function extractYouTubeId(url:string):string|null{
  const ps=[/(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,/(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,/(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,/(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/];
  for(const p of ps){const m=url.match(p);if(m)return m[1];}
  return null;
}

export default function VendorMedia(){
  const [vendorId,setVendorId]=useState<string|null>(null);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [uploading,setUploading]=useState(false);
  const [focused,setFocused]=useState('');

  const [logoUrl,setLogoUrl]=useState<string|null>(null);
  const [coverUrl,setCoverUrl]=useState<string|null>(null);
  const [portfolioUrls,setPortfolioUrls]=useState<string[]>([]);
  const [videoUrl,setVideoUrl]=useState('');
  const [socialLinks,setSocialLinks]=useState({instagram:'',facebook:'',tiktok:'',website:''});
  const [contact,setContact]=useState({whatsapp:'',phone:'',preferredContact:'whatsapp' as PreferredContact});
  const [needsOnboarding,setNeedsOnboarding]=useState<boolean|null>(null);
  const [forcedEdit,setForcedEdit]=useState(false);

  useEffect(()=>{
    (async()=>{
      try{
        const {data:{user}}=await supabase.auth.getUser();
        if(!user){setLoading(false);return;}
        let vendor:any=null;
        const {data:v1}=await supabase.from('vendors').select('id,logo_url,cover_url,portfolio_urls,social_links,contact,is_published,onboarding_completed').eq('user_id',user.id).order('created_at',{ascending:false}).limit(1).maybeSingle();
        if(v1)vendor=v1;
        else{const {data:v2}=await supabase.from('vendors').select('id,logo_url,cover_url,portfolio_urls,social_links,contact,is_published,onboarding_completed').eq('id',user.id).maybeSingle();if(v2)vendor=v2;}
        if(vendor){
          setVendorId(vendor.id);
          setLogoUrl(vendor.logo_url||null);
          setCoverUrl(vendor.cover_url||null);
          setPortfolioUrls(vendor.portfolio_urls||[]);
          if(vendor.social_links){setSocialLinks({instagram:'',facebook:'',tiktok:'',website:'',...vendor.social_links});if(vendor.social_links.youtube)setVideoUrl(vendor.social_links.youtube);}
          if(vendor.contact)setContact({whatsapp:'',phone:'',preferredContact:'whatsapp',...vendor.contact});
        }
      }catch(err){console.error('Error loading vendor media:',err);}finally{setLoading(false);}
    })();
  },[]);

  useEffect(()=>{
    if(!vendorId)return;
    (async()=>{try{const s=await getVendorSetupStatus(supabase,vendorId);setNeedsOnboarding(Boolean(s.needsOnboarding));}catch{/*ok*/}})();
  },[vendorId]);

  useEffect(()=>{
    if(typeof window!=='undefined')setForcedEdit(new URLSearchParams(window.location.search).get('mode')==='edit');
  },[]);

  const uploadFile=async(file:File,folder:string):Promise<string|null>=>{
    if(!vendorId)return null;
    const ext=file.name.split('.').pop()||'jpg';
    const filePath=`${vendorId}/${folder}/${Date.now()}.${ext}`;
    const {error}=await supabase.storage.from('vendor-media').upload(filePath,file,{cacheControl:'3600',upsert:false});
    if(error){console.error('Upload error:',error);return null;}
    const {data}=supabase.storage.from('vendor-media').getPublicUrl(filePath) as any;
    return data?.publicUrl||null;
  };

  const handleImageUpload=async(e:React.ChangeEvent<HTMLInputElement>,type:'logo'|'cover'|'portfolio')=>{
    const files=e.target.files;
    if(!files||files.length===0||!vendorId)return;
    setUploading(true);
    try{
      if(type==='portfolio'){
        const newUrls:string[]=[];
        for(const file of Array.from(files)){const url=await uploadFile(file,'portfolio');if(url)newUrls.push(url);}
        if(newUrls.length>0){
          setPortfolioUrls(prev=>{
            const updated=[...prev,...newUrls];
            // Auto-save to DB so progress survives app switching
            supabase.from('vendors').update({portfolio_urls:updated,portfolio_images:updated.length}).eq('id',vendorId).then(({error})=>{if(error)console.error('Auto-save portfolio error:',error);});
            return updated;
          });
        }
      }else{
        const url=await uploadFile(files[0],type);
        if(url){
          if(type==='logo'){
            setLogoUrl(url);
            // Auto-save logo to DB immediately
            const {error}=await supabase.from('vendors').update({logo_url:url}).eq('id',vendorId);
            if(error)console.error('Auto-save logo error:',error);
          }else{
            setCoverUrl(url);
            // Auto-save cover to DB immediately
            const {error}=await supabase.from('vendors').update({cover_url:url}).eq('id',vendorId);
            if(error)console.error('Auto-save cover error:',error);
          }
        }
      }
    }catch(err){console.error('Upload failed:',err);alert('Upload failed. Please try again.');}finally{setUploading(false);}
  };

  const removePortfolioImage=(index:number)=>setPortfolioUrls(portfolioUrls.filter((_,i)=>i!==index));

  const handleSave=async()=>{
    if(!vendorId)return;
    setSaving(true);
    try{
      const {error}=await supabase.from('vendors').update({logo_url:logoUrl,cover_url:coverUrl,portfolio_urls:portfolioUrls,portfolio_images:portfolioUrls.length,social_links:{...socialLinks,...(videoUrl.trim()?{youtube:videoUrl.trim()}:{})},contact}).eq('id',vendorId);
      if(error){console.error('Save error:',error);alert('Failed to save. Please try again.');}
    }catch(err){console.error('Save error:',err);}finally{setSaving(false);}
  };

  const hasAtLeastOneSocialLink=Object.values(socialLinks).some(l=>l.trim()!=='');
  const canContinue=Boolean(logoUrl)&&(portfolioUrls.length>=3||hasAtLeastOneSocialLink);
  const modeOnboarding=typeof window!=='undefined'&&new URLSearchParams(window.location.search).get('mode')==='onboarding';
  const isOnboarding=modeOnboarding||Boolean(needsOnboarding);
  const editMode=!isOnboarding;
  const backHref=editMode?'/vendor/dashboard':'/vendor/packages?mode=onboarding';

  const ytId=videoUrl.trim()?extractYouTubeId(videoUrl.trim()):null;

  if(loading)return <LoadingPage />;

  return(
    <div style={{minHeight:'100svh',background:BG,fontFamily:"'DM Sans',system-ui,sans-serif"}}>
      <style>{`
        @keyframes mdspin{to{transform:rotate(360deg)}}
        @keyframes mdU{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        .mdU1{animation:mdU .38s ease .05s both}.mdU2{animation:mdU .38s ease .10s both}
        .mdU3{animation:mdU .38s ease .15s both}.mdU4{animation:mdU .38s ease .20s both}
        .mdU5{animation:mdU .38s ease .25s both}.mdU6{animation:mdU .38s ease .30s both}
        input,select,textarea,button{font-family:inherit!important}
        .md-cta:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 8px 28px rgba(154,33,67,0.38)!important}
        .md-cta{transition:all .15s}
        .md-back:hover{background:#f5f0ee!important}
        .md-uzl:hover{border-color:${CR}!important;background:rgba(154,33,67,0.04)!important}
        .md-uzl{transition:all .14s}
        .md-soc:hover{border-color:${CR}!important}
        .md-soc{transition:border-color .14s}
      `}</style>
      <ProfileCompletionIndicator/>

      {/* Header */}
      <div style={{background:`linear-gradient(160deg,${CRX} 0%,${CR} 52%,#c03050 100%)`,position:'relative',overflow:'hidden'}}>
        <div style={{position:'absolute',top:-50,right:-50,width:200,height:200,borderRadius:'50%',border:'1.5px solid rgba(189,152,63,0.1)',pointerEvents:'none'}}/>
        <div style={{position:'absolute',top:-26,right:-26,width:115,height:115,borderRadius:'50%',border:'1.5px solid rgba(189,152,63,0.17)',pointerEvents:'none'}}/>
        <div style={{position:'relative',padding:'22px 20px 0'}}>
          <p style={{margin:'0 0 3px',fontSize:10,fontWeight:800,color:'rgba(255,255,255,0.4)',letterSpacing:1.5,textTransform:'uppercase'}}>Step 4 of 5</p>
          <h1 style={{margin:'0 0 3px',fontSize:22,fontWeight:800,color:'#fff',fontFamily:'Georgia,serif',letterSpacing:-.3}}>Media & portfolio</h1>
          <p style={{margin:0,fontSize:13,color:'rgba(255,255,255,0.5)'}}>Show your best work so couples can trust you</p>
        </div>
        <div style={{height:18}}/>
        <VendorOnboardingProgress step={4}/>
      </div>

      {/* Body */}
      <div style={{maxWidth:640,margin:'0 auto',padding:'22px 16px calc(110px + env(safe-area-inset-bottom))',display:'flex',flexDirection:'column',gap:28}}>

        {/* Upload indicator */}
        {uploading&&(
          <div style={{padding:'12px 16px',borderRadius:12,background:'rgba(30,100,180,0.07)',border:'1.5px solid rgba(30,100,180,0.2)',display:'flex',alignItems:'center',gap:10}}>
            <div style={{width:16,height:16,border:'2px solid rgba(30,100,180,0.2)',borderTopColor:'#1e64b4',borderRadius:'50%',animation:'mdspin .8s linear infinite',flexShrink:0}}/>
            <span style={{fontSize:13,fontWeight:700,color:'#1e64b4'}}>Uploading…</span>
          </div>
        )}

        {/* LOGO */}
        <div className="mdU1">
          <FL l="Business logo" />
          {logoUrl?(
            <div style={{position:'relative',width:120,height:120,borderRadius:16,overflow:'hidden',border:`2px solid ${BOR}`,background:'#fff'}}>
              <Image src={logoUrl} alt="Logo" fill sizes="120px" style={{objectFit:'contain',padding:8}}/>
              <button type="button" onClick={()=>setLogoUrl(null)} style={{position:'absolute',top:6,right:6,width:24,height:24,borderRadius:'50%',background:'#c0392b',border:'none',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
                <svg width="10" height="10" fill="none" stroke="#fff" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
          ):(
            <label className="md-uzl" style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',width:'100%',padding:'22px 16px',borderRadius:14,border:`2px dashed rgba(154,33,67,0.3)`,background:'rgba(154,33,67,0.02)',cursor:'pointer',gap:8}}>
              <span style={{fontSize:28}}>🏢</span>
              <span style={{fontSize:13.5,fontWeight:700,color:CR}}>Upload business logo</span>
              <span style={{fontSize:11.5,color:MUT}}>PNG or JPG, square format recommended</span>
              <input type="file" accept="image/*" onChange={e=>handleImageUpload(e,'logo')} style={{display:'none'}}/>
            </label>
          )}
          <p style={{margin:'6px 0 0',fontSize:11.5,color:MUT}}>Required — couples see this next to your name</p>
        </div>

        {/* COVER */}
        <div className="mdU2">
          <FL l="Cover image" opt/>
          {coverUrl?(
            <div style={{position:'relative',width:'100%',height:180,borderRadius:16,overflow:'hidden',border:`2px solid ${BOR}`}}>
              <Image src={coverUrl} alt="Cover" fill sizes="100vw" style={{objectFit:'cover'}}/>
              <button type="button" onClick={()=>setCoverUrl(null)} style={{position:'absolute',top:8,right:8,width:28,height:28,borderRadius:'50%',background:'#c0392b',border:'none',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
                <svg width="11" height="11" fill="none" stroke="#fff" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
          ):(
            <label className="md-uzl" style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',width:'100%',padding:'28px 16px',borderRadius:14,border:`2px dashed ${BOR}`,background:'rgba(0,0,0,0.01)',cursor:'pointer',gap:8}}>
              <span style={{fontSize:28}}>🖼️</span>
              <span style={{fontSize:13.5,fontWeight:700,color:MUT}}>Upload cover image</span>
              <span style={{fontSize:11.5,color:MUT}}>Wide landscape photo, 16:9 ratio works best</span>
              <input type="file" accept="image/*" onChange={e=>handleImageUpload(e,'cover')} style={{display:'none'}}/>
            </label>
          )}
        </div>

        {/* PORTFOLIO */}
        <div className="mdU3">
          <FL l="Portfolio gallery"/>
          <p style={{margin:'-2px 0 10px',fontSize:11.5,color:MUT}}>Add at least 3 photos of your work (6+ recommended)</p>
          <label className="md-uzl" style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',width:'100%',padding:'20px 16px',borderRadius:14,border:`2px dashed rgba(154,33,67,0.3)`,background:'rgba(154,33,67,0.02)',cursor:'pointer',gap:6,marginBottom:portfolioUrls.length>0?12:0}}>
            <span style={{fontSize:24}}>📸</span>
            <span style={{fontSize:13,fontWeight:700,color:CR}}>Add portfolio images</span>
            <span style={{fontSize:11.5,color:MUT}}>{portfolioUrls.length} uploaded</span>
            <input type="file" accept="image/*" multiple onChange={e=>handleImageUpload(e,'portfolio')} style={{display:'none'}}/>
          </label>
          {portfolioUrls.length>0&&(
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
              {portfolioUrls.map((url,i)=>(
                <div key={i} style={{position:'relative',aspectRatio:'1',borderRadius:10,overflow:'hidden',border:`1.5px solid ${BOR}`}}>
                  <Image src={url} alt={`Portfolio ${i+1}`} fill sizes="33vw" style={{objectFit:'cover'}}/>
                  <button type="button" onClick={()=>removePortfolioImage(i)} style={{position:'absolute',top:5,right:5,width:22,height:22,borderRadius:'50%',background:'#c0392b',border:'none',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
                    <svg width="9" height="9" fill="none" stroke="#fff" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* VIDEO */}
        <div className="mdU4">
          <FL l="Video showreel" opt/>
          <p style={{margin:'-2px 0 8px',fontSize:11.5,color:MUT}}>Paste a YouTube link to show your work in action</p>
          <input type="url" value={videoUrl} placeholder="https://www.youtube.com/watch?v=…"
            onFocus={()=>setFocused('yt')} onBlur={()=>setFocused('')}
            onChange={e=>setVideoUrl(e.target.value)}
            style={ICS(focused==='yt')}/>
          {videoUrl.trim()&&(ytId?(
            <div style={{marginTop:12,borderRadius:14,overflow:'hidden',border:`1.5px solid ${BOR}`}}>
              <div style={{position:'relative',width:'100%',paddingBottom:'56.25%'}}>
                <iframe style={{position:'absolute',inset:0,width:'100%',height:'100%'}} src={`https://www.youtube.com/embed/${ytId}`} title="Video preview" allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowFullScreen/>
              </div>
            </div>
          ):(
            <p style={{margin:'6px 0 0',fontSize:12,color:'#d4804f'}}>⚠ Paste a valid YouTube URL to preview</p>
          ))}
        </div>

        {/* SOCIAL LINKS */}
        <div className="mdU5">
          <p style={{margin:'0 0 12px',fontSize:10.5,fontWeight:800,color:MUT,letterSpacing:1.1,textTransform:'uppercase'}}>Social media & website</p>
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {(['instagram','facebook','tiktok','website'] as const).map(key=>(
              <div key={key} style={{display:'flex',alignItems:'center',gap:10}}>
                <div style={{width:38,height:38,borderRadius:10,background:'rgba(154,33,67,0.06)',border:`1.5px solid ${BOR}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:16}}>
                  {key==='instagram'?'📸':key==='facebook'?'👥':key==='tiktok'?'🎵':'🌐'}
                </div>
                <input value={socialLinks[key]} placeholder={
                  key==='instagram'?'@yourhandle':key==='facebook'?'facebook.com/yourpage':key==='tiktok'?'@yourtiktok':'https://yourwebsite.com'
                }
                  onFocus={()=>setFocused(key)} onBlur={()=>setFocused('')}
                  onChange={e=>setSocialLinks({...socialLinks,[key]:e.target.value})}
                  style={ICS(focused===key)}/>
              </div>
            ))}
          </div>
        </div>

        {/* CONTACT */}
        <div className="mdU6">
          <p style={{margin:'0 0 12px',fontSize:10.5,fontWeight:800,color:MUT,letterSpacing:1.1,textTransform:'uppercase'}}>Contact details</p>
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            <div>
              <FL l="WhatsApp number" opt/>
              <input value={contact.whatsapp} placeholder="+27 82 000 0000"
                onFocus={()=>setFocused('wa')} onBlur={()=>setFocused('')}
                onChange={e=>setContact({...contact,whatsapp:e.target.value})}
                style={ICS(focused==='wa')}/>
            </div>
            <div>
              <FL l="Phone number" opt/>
              <input value={contact.phone} placeholder="+27 11 000 0000"
                onFocus={()=>setFocused('ph')} onBlur={()=>setFocused('')}
                onChange={e=>setContact({...contact,phone:e.target.value})}
                style={ICS(focused==='ph')}/>
            </div>
            <div>
              <FL l="Preferred contact method"/>
              <div style={{display:'flex',gap:8}}>
                {(['whatsapp','chat','call'] as const).map(m=>(
                  <button key={m} type="button" onClick={()=>setContact({...contact,preferredContact:m})}
                    style={{flex:1,padding:'10px',borderRadius:12,border:`1.5px solid ${contact.preferredContact===m?CR:BOR}`,background:contact.preferredContact===m?'rgba(154,33,67,0.06)':'#fff',color:contact.preferredContact===m?CR:MUT,fontSize:12.5,fontWeight:700,cursor:'pointer',transition:'all .13s',fontFamily:'inherit'}}>
                    {m==='whatsapp'?'WhatsApp':m==='chat'?'In-app chat':'Phone call'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Readiness indicator */}
        <div style={{padding:'14px 16px',borderRadius:14,background:canContinue?'rgba(30,122,78,0.07)':'rgba(154,33,67,0.05)',border:`1.5px solid ${canContinue?'rgba(30,122,78,0.2)':'rgba(154,33,67,0.12)'}`,display:'flex',alignItems:'flex-start',gap:10}}>
          <span style={{fontSize:18,flexShrink:0}}>{canContinue?'✅':'📋'}</span>
          <div>
            <p style={{margin:'0 0 2px',fontSize:13,fontWeight:700,color:canContinue?'#1e7a4e':CR}}>
              {canContinue?'Looking great!':'Almost there'}
            </p>
            <p style={{margin:0,fontSize:12,color:MUT,lineHeight:1.55}}>
              {canContinue?'Your profile has enough media to go live. Save and continue.':'Add a logo + at least 3 portfolio photos (or a social link) to continue.'}
            </p>
          </div>
        </div>
      </div>

      {/* Bottom nav */}
      <div style={{position:'fixed',bottom:0,left:0,right:0,background:'#fff',borderTop:`1px solid ${BOR}`,padding:'14px 16px calc(14px + env(safe-area-inset-bottom))',zIndex:40,boxShadow:'0 -4px 20px rgba(26,13,18,0.06)'}}>
        <div style={{maxWidth:640,margin:'0 auto',display:'flex',gap:10}}>
          <Link href={backHref} className="md-back" style={{flex:1,padding:'13px',borderRadius:13,border:`1.5px solid ${BOR}`,background:'#fff',color:DK,fontSize:14,fontWeight:700,textDecoration:'none',display:'flex',alignItems:'center',justifyContent:'center',transition:'background .14s'}}>
            ← Back
          </Link>
          <button onClick={async()=>{await handleSave();if(canContinue){const next=isOnboarding?'/vendor/review?mode=onboarding':'/vendor/dashboard';window.location.href=next;}}} disabled={saving||!canContinue} className="md-cta"
            style={{flex:2,padding:'13px',borderRadius:13,border:'none',background:canContinue?`linear-gradient(135deg,${CR},${CR2})`:'rgba(154,33,67,0.2)',color:'#fff',fontSize:14,fontWeight:800,cursor:canContinue&&!saving?'pointer':'default',boxShadow:canContinue?'0 4px 18px rgba(154,33,67,0.28)':'none',display:'flex',alignItems:'center',justifyContent:'center',gap:9,fontFamily:'inherit'}}>
            {saving&&<div style={{width:16,height:16,border:'2px solid rgba(255,255,255,.3)',borderTopColor:'#fff',borderRadius:'50%',animation:'mdspin .8s linear infinite'}}/>}
            {saving?'Saving…':isOnboarding?'Save & Continue →':'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
