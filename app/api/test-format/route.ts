import { NextResponse } from 'next/server';
import { formatPrice } from '@/lib/currency';
import { isDevOnly } from '@/lib/devOnly';

export async function GET() {
  if (!isDevOnly) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  try {
    const res = await fetch('http://localhost:3000/api/exchange-rates');
    const json = await res.json();
    const rates = json?.rates || null;
    const formatted = formatPrice(13500, 'USD', rates || undefined);
    return NextResponse.json({ sampleZar: 13500, formatted });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
