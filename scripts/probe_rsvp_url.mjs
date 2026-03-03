import fetch from 'node-fetch';

(async ()=>{
  try{
    const url = 'https://umshado-app.vercel.app/rsvp/03589373-7333-4741-a32e-3cab8a96efeb/t/90ba16b8-29dd-4158-9155-cadaa115c56d?view=card';
    const res = await fetch(url, { redirect: 'follow' });
    console.log('status', res.status);
    const txt = await res.text();
    console.log('bodySnippet:\n', txt.slice(0,1000));
  } catch (e) {
    console.error('fetch error', e);
  }
})();
