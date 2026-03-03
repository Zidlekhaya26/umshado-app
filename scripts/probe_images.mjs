(async ()=>{
  const tests=[
    'https://via.placeholder.com/600x600.png?text=Couple',
    'https://placekitten.com/600/600',
    'https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png'
  ];
  for(const up of tests){
    console.log('\n-- UPSTREAM TEST --',up);
    try{
      const ru=await fetch(up);
      console.log('Upstream status',ru.status);
      console.log('Upstream content-type',ru.headers.get('content-type'));
      const bu=await ru.arrayBuffer();
      console.log('Upstream byteLength',bu.byteLength);
    }catch(e){
      console.error('Upstream fetch error',e.message);
    }
    const proxyUrl='https://umshado-app.vercel.app/api/image-proxy?url='+encodeURIComponent(up);
    console.log('Proxy URL',proxyUrl);
    try{
      const rp=await fetch(proxyUrl);
      console.log('Proxy status',rp.status);
      console.log('Proxy content-type',rp.headers.get('content-type'));
      if((rp.headers.get('content-type')||'').includes('json')){
        console.log('Proxy json:',await rp.text())
      } else {
        const b=await rp.arrayBuffer();
        console.log('Proxy byteLength',b.byteLength);
      }
    }catch(e){
      console.error('Proxy fetch error',e.message);
    }
  }
})();
