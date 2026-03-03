import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) return NextResponse.json({ error: 'Missing url query' }, { status: 400 });

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch (e) {
    return NextResponse.json({ error: 'Invalid url' }, { status: 400 });
  }

  if (!/^https?:$/i.test(parsed.protocol)) {
    return NextResponse.json({ error: 'Only http/https allowed' }, { status: 400 });
  }

  try {
    const upstream = parsed.toString();
    const res = await fetch(upstream, {
      method: 'GET',
      // avoid local CPU cache and ensure fresh copy
      cache: 'no-store',
      headers: {
        'User-Agent': 'uMshado-image-proxy/1.0',
        Accept: 'image/*,*/*;q=0.8',
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('image-proxy upstream failed', res.status, upstream, text.slice(0, 500));
      return NextResponse.json({ error: 'Upstream fetch failed', status: res.status }, { status: res.status });
    }

    const contentType = res.headers.get('content-type') || 'application/octet-stream';
    const arrayBuffer = await res.arrayBuffer();
    const headers = new Headers();
    headers.set('Content-Type', contentType);
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    headers.set('Access-Control-Allow-Origin', '*');

    return new NextResponse(arrayBuffer, { status: 200, headers });
  } catch (err: any) {
    console.warn('image-proxy fallback used:', err && err.message ? err.message : err);

    // Try fetching a public fallback image hosted at NEXT_PUBLIC_APP_URL
    const fallbackUrl = process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')}/default-avatar.png`
      : undefined;

    try {
      if (fallbackUrl && /^https?:\/\//i.test(fallbackUrl)) {
        const fbRes = await fetch(fallbackUrl, { method: 'GET', cache: 'no-store' });
        if (fbRes.ok) {
          const fbBuffer = await fbRes.arrayBuffer();
          const headers = new Headers();
          headers.set('Content-Type', fbRes.headers.get('content-type') || 'image/png');
          headers.set('Cache-Control', 'public, max-age=86400');
          headers.set('Access-Control-Allow-Origin', '*');
          return new NextResponse(fbBuffer, { status: 200, headers });
        }
      }
    } catch (fbErr: any) {
      console.warn('image-proxy fallback fetch failed', fbErr && fbErr.message ? fbErr.message : fbErr);
    }

    // As a last resort, try reading a local file from the deployment `public` folder
    try {
      const localPath = path.join(process.cwd(), 'public', 'default-avatar.png');
      const file = await fs.readFile(localPath);
      const headers = new Headers();
      headers.set('Content-Type', 'image/png');
      headers.set('Cache-Control', 'public, max-age=86400');
      headers.set('Access-Control-Allow-Origin', '*');
      return new NextResponse(file, { status: 200, headers });
    } catch (fsErr: any) {
      console.error('image-proxy fallback local file failed', fsErr && fsErr.message ? fsErr.message : fsErr);
    }

    return NextResponse.json({ error: 'Proxy error' }, { status: 500 });
  }
}
