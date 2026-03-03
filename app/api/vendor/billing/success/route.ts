import { NextRequest, NextResponse } from 'next/server';

// PayFast calls this after payment — redirect vendor to billing with success message
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const intent = searchParams.get('intent');
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://umshado.co.za';
  // Redirect to billing page with success param — webhook does actual activation
  return NextResponse.redirect(`${baseUrl}/vendor/billing?success=1&intent=${intent || ''}`);
}
