import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createServiceClient } from '@/lib/supabaseServer';

const client = new Anthropic();

export async function POST(req: NextRequest) {
  try {
    // Auth
    const authHeader = req.headers.get('authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = createServiceClient();
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Fetch vendor info
    const { data: vendor } = await supabase
      .from('vendors')
      .select('business_name, category, description, subscription_tier')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });

    const isPro = vendor.subscription_tier === 'pro' || vendor.subscription_tier === 'trial';
    if (!isPro) return NextResponse.json({ error: 'Pro feature' }, { status: 403 });

    const name = vendor.business_name ?? 'the business';
    const category = vendor.category ?? 'wedding services';
    const description = vendor.description ?? '';

    const prompt = `You are AMi, an AI marketing assistant for uMshado — South Africa's premier wedding marketplace.

Generate compelling, SHORT ad copy for this wedding vendor:
- Business: ${name}
- Category: ${category}
- About: ${description ? description.slice(0, 300) : 'Professional wedding vendor'}

Rules:
- Headlines: max 8 words, punchy, benefit-focused, no hype words like "amazing" or "best"
- Body: max 20 words, specific and credible, mention location/culture if relevant
- CTA: max 3 words, action verbs only (e.g. "View Packages", "Book Now", "See Portfolio")
- Tone: premium, warm, South African context
- No emojis, no exclamation marks

Return ONLY valid JSON in this exact shape:
{
  "headlines": ["<option1>", "<option2>", "<option3>"],
  "bodies": ["<option1>", "<option2>", "<option3>"],
  "ctas": ["View Portfolio", "Book Now", "Get a Quote"]
}`;

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = (message.content[0] as { type: string; text: string }).text.trim();
    // Extract JSON even if surrounded by markdown fences
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json({ error: 'Invalid AI response' }, { status: 500 });

    const suggestions = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ suggestions });
  } catch (err) {
    console.error('[ami-ad]', err);
    return NextResponse.json({ error: 'Failed to generate suggestions' }, { status: 500 });
  }
}
