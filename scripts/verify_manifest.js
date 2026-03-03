(async () => {
  const urls = [
    'https://umshado-app.vercel.app/manifest.json',
    'https://umshado-app.vercel.app/logo-icon.png',
    'https://umshado-app.vercel.app/logo-full.png'
  ];

  for (const u of urls) {
    try {
      const res = await fetch(u);
      console.log('URL:', u);
      console.log('Status:', res.status);
      console.log('Content-Type:', res.headers.get('content-type'));
      if (u.endsWith('manifest.json')) {
        console.log('--- manifest ---');
        const t = await res.text();
        console.log(t);
        console.log('--- end manifest ---');
      }
    } catch (err) {
      console.error('Error fetching', u, err && err.message ? err.message : err);
    }
    console.log('');
  }
})();
