#!/usr/bin/env node
const url = 'https://umshado-app.vercel.app/api/image-proxy?url=https%3A%2F%2Fimages.unsplash.com%2Fphoto-1502685104226-ee32379fefbe%3Fw%3D800%26h%3D800%26fit%3Dcrop';
(async ()=>{
  try {
    const r = await fetch(url);
    console.log('FETCH STATUS', r.status);
    const text = await r.text().catch(()=>null);
    if (text) console.log('BODY PREVIEW:', text.slice(0,1000));
  } catch (e) {
    console.error('fetch error', e);
    process.exit(1);
  }
})();
