import { readFile } from 'fs/promises';
import path from 'path';

export async function GET(req: Request, context: any) {
  try {
    // Support both sync and async `context.params` shapes observed across Next versions
    let params: any = context?.params;
    if (params && typeof params.then === 'function') params = await params;
    const requested = (params?.icon || []).join('/');
    // Serve existing public images as fallbacks for missing /assets/icons/*
    const cwd = process.cwd();
    let filePath: string;

    if (requested.includes('192')) {
      filePath = path.join(cwd, 'public', 'logo-icon.png');
    } else if (requested.includes('512')) {
      filePath = path.join(cwd, 'public', 'logo-full.png');
    } else {
      filePath = path.join(cwd, 'public', 'logo-icon.png');
    }

    const buf = await readFile(filePath);
    return new Response(buf, { status: 200, headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
  }
}
