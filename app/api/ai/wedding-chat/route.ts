import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

// ── Rate limit ────────────────────────────────────────────────
const DAILY_MESSAGE_LIMIT = 30; // free tier; raise for paid plans

// ── Auth helper ───────────────────────────────────────────────
async function getUserId(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);

  const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: supabaseAnon },
  });
  if (!res.ok) return null;
  const user = await res.json();
  return user?.id ?? null;
}

// ── Build rich system prompt from couple's live data ──────────
function buildSystemPrompt(ctx: {
  partnerName:   string | null;
  weddingDate:   string | null;
  location:      string | null;
  daysLeft:      number | null;
  totalBudget:   number;
  totalPaid:     number;
  totalTasks:    number;
  doneTasks:     number;
  totalGuests:   number;
  gAccepted:     number;
  bookedCategories: string[];
  openCategories:   string[];
}): string {
  const {
    partnerName, weddingDate, location, daysLeft,
    totalBudget, totalPaid, totalTasks, doneTasks,
    totalGuests, gAccepted, bookedCategories, openCategories,
  } = ctx;

  const today = new Date().toLocaleDateString('en-ZA', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const budgetRemaining = totalBudget - totalPaid;
  const tasksPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const weddingDateFormatted = weddingDate
    ? new Date(weddingDate + 'T00:00:00').toLocaleDateString('en-ZA', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      })
    : null;

  return `You are Ami – uMshado's warm, knowledgeable AI wedding planning assistant. uMshado is a South African wedding planning platform.

TODAY'S DATE: ${today}

COUPLE PROFILE:
${partnerName ? `- Names: ${partnerName}` : ''}
${weddingDateFormatted ? `- Wedding date: ${weddingDateFormatted} (${daysLeft} days away)` : '- Wedding date: not yet set'}
${location ? `- Venue / location: ${location}` : '- Location: not yet set'}
- Planning progress: ${doneTasks}/${totalTasks} tasks complete (${tasksPct}%)
- Total budget: R${totalBudget.toLocaleString('en-ZA')} | Paid so far: R${totalPaid.toLocaleString('en-ZA')} | Remaining: R${budgetRemaining.toLocaleString('en-ZA')}
- Guest list: ${totalGuests} invited, ${gAccepted} confirmed
${bookedCategories.length > 0 ? `- Already booked: ${bookedCategories.join(', ')}` : ''}
${openCategories.length > 0 ? `- Still to book: ${openCategories.join(', ')}` : ''}

YOUR PERSONALITY & TONE:
- Warm, encouraging, and practical – like a knowledgeable best friend who has planned 200 weddings
- Speak naturally. No corporate language, no bullet-point spam for every reply
- Use a light South African context where relevant (vendors, traditions, costs in ZAR, weather/seasons)
- Be concise. Most answers should be 2-4 short paragraphs. Go longer only when the couple asks for a detailed plan
- Offer 1-2 concrete next steps at the end of planning advice, not a full list every time

WHAT YOU CAN HELP WITH:
- Wedding timelines and "what to book when" guidance
- Budget breakdowns and vendor cost expectations in South Africa
- Vendor category comparisons (photographer vs videographer priority, etc.)
- Day-of schedules and run sheets
- Guest management, RSVP chasing, seating logistics
- South African traditions (lobola, traditional ceremonies, combining cultures)
- Colour palettes, décor styles, theme ideas
- Writing vendor messages, negotiating quotes, asking the right questions
- Hen parties, rehearsal dinners, day-after brunches
- Stress management – remind them it's supposed to be fun!

IMPORTANT BOUNDARIES:
- You are a wedding planning assistant. Politely redirect non-wedding questions
- Never make up specific vendor names or prices – give realistic ZAR ranges instead
- If they ask about a specific vendor on uMshado, tell them to check the Marketplace tab
- Never give legal or medical advice
- Keep responses focused. One topic at a time unless they explicitly ask for a full breakdown

Start every first message warmly, acknowledging their specific wedding details if set.`;
}

// ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // 1. Auth
  const userId = await getUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  // 2. Parse body
  let body: { message: string; clearHistory?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const userMessage = body.message?.trim();
  if (!userMessage && !body.clearHistory) {
    return NextResponse.json({ error: 'message is required' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // 3. Check daily rate limit
  const today = new Date().toISOString().split('T')[0];
  const { data: usageRow } = await supabase
    .from('ai_usage')
    .select('messages_sent, tokens_used')
    .eq('couple_id', userId)
    .eq('date', today)
    .maybeSingle();

  const messagesSentToday = usageRow?.messages_sent ?? 0;
  if (messagesSentToday >= DAILY_MESSAGE_LIMIT) {
    return NextResponse.json(
      {
        error: 'daily_limit_reached',
        message: `You've used all ${DAILY_MESSAGE_LIMIT} AI messages for today. Your limit resets at midnight. ✨`,
        messagesUsed: messagesSentToday,
        dailyLimit: DAILY_MESSAGE_LIMIT,
      },
      { status: 429 }
    );
  }

  // 4. Load couple context for system prompt
  const [coupleRes, tasksRes, budgetRes, guestsRes, quotesRes] = await Promise.all([
    supabase
      .from('couples')
      .select('partner_name, wedding_date, location')
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('couple_tasks')
      .select('is_done')
      .eq('couple_id', userId),
    supabase
      .from('couple_budget_items')
      .select('amount, amount_paid')
      .eq('couple_id', userId),
    supabase
      .from('couple_guests')
      .select('rsvp_status')
      .eq('couple_id', userId),
    supabase
      .from('quotes')
      .select('status, package_name')
      .eq('couple_id', userId)
      .in('status', ['accepted']),
  ]);

  const couple     = coupleRes.data;
  const tasks      = tasksRes.data  ?? [];
  const budget     = budgetRes.data ?? [];
  const guests     = guestsRes.data ?? [];
  const accepted   = quotesRes.data ?? [];

  const weddingDate = couple?.wedding_date ?? null;
  const daysLeft    = weddingDate
    ? Math.max(0, Math.ceil((new Date(weddingDate + 'T00:00:00').getTime() - Date.now()) / 86400000))
    : null;

  const totalBudget = budget.reduce((s, b) => s + Number(b.amount ?? 0), 0);
  const totalPaid   = budget.reduce((s, b) => s + Number(b.amount_paid ?? 0), 0);
  const gAccepted   = guests.filter(g => g.rsvp_status === 'accepted').length;

  // Derive booked vendor categories from accepted quotes
  const bookedCategories = [
    ...new Set(accepted.map(q => q.package_name).filter(Boolean) as string[]),
  ];

  const systemPrompt = buildSystemPrompt({
    partnerName:      couple?.partner_name ?? null,
    weddingDate,
    location:         couple?.location ?? null,
    daysLeft,
    totalBudget,
    totalPaid,
    totalTasks:       tasks.length,
    doneTasks:        tasks.filter(t => t.is_done).length,
    totalGuests:      guests.length,
    gAccepted,
    bookedCategories,
    openCategories:   [], // could expand later from a standard category list
  });

  // 5. Load or create conversation history
  const { data: convRow } = await supabase
    .from('ai_conversations')
    .select('id, messages')
    .eq('couple_id', userId)
    .maybeSingle();

  // clearHistory = wipe and start fresh
  if (body.clearHistory) {
    if (convRow) {
      await supabase
        .from('ai_conversations')
        .update({ messages: [], message_count: 0 })
        .eq('couple_id', userId);
    }
    return NextResponse.json({ ok: true });
  }

  type ChatMessage = { role: 'user' | 'assistant'; content: string; ts: string };
  const history: ChatMessage[] = (convRow?.messages as ChatMessage[]) ?? [];

  // Keep last 20 turns (40 messages) to stay within context budget
  const trimmedHistory = history.slice(-40);

  // Build messages array for Claude
  const claudeMessages = [
    ...trimmedHistory.map(m => ({ role: m.role, content: m.content })),
    { role: 'user' as const, content: userMessage },
  ];

  // 6. Call Anthropic API
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    console.error('[ai/wedding-chat] ANTHROPIC_API_KEY not set');
    return NextResponse.json({ error: 'AI service not configured' }, { status: 500 });
  }

  let assistantContent = '';
  let inputTokens  = 0;
  let outputTokens = 0;

  try {
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',  // fast + cheap for chat
        max_tokens: 1024,
        system:     systemPrompt,
        messages:   claudeMessages,
      }),
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.text();
      console.error('[ai/wedding-chat] Claude API error:', claudeRes.status, err);
      return NextResponse.json({ error: 'AI service unavailable. Please try again.' }, { status: 502 });
    }

    const claudeData = await claudeRes.json();
    assistantContent = claudeData.content?.[0]?.text ?? '';
    inputTokens      = claudeData.usage?.input_tokens  ?? 0;
    outputTokens     = claudeData.usage?.output_tokens ?? 0;
  } catch (err) {
    console.error('[ai/wedding-chat] fetch error:', err);
    return NextResponse.json({ error: 'Network error calling AI service.' }, { status: 502 });
  }

  // 7. Persist updated history
  const now = new Date().toISOString();
  const updatedHistory: ChatMessage[] = [
    ...trimmedHistory,
    { role: 'user',      content: userMessage,       ts: now },
    { role: 'assistant', content: assistantContent,  ts: now },
  ];

  if (convRow) {
    await supabase
      .from('ai_conversations')
      .update({
        messages:      updatedHistory,
        message_count: updatedHistory.length,
      })
      .eq('couple_id', userId);
  } else {
    await supabase.from('ai_conversations').insert({
      couple_id:     userId,
      messages:      updatedHistory,
      message_count: updatedHistory.length,
    });
  }

  // 8. Upsert daily usage
  await supabase.from('ai_usage').upsert(
    {
      couple_id:     userId,
      date:          today,
      messages_sent: messagesSentToday + 1,
      tokens_used:   (usageRow?.tokens_used ?? 0) + inputTokens + outputTokens,
    },
    { onConflict: 'couple_id,date' }
  );

  // 9. Respond
  return NextResponse.json({
    reply:         assistantContent,
    messagesUsed:  messagesSentToday + 1,
    dailyLimit:    DAILY_MESSAGE_LIMIT,
  });
}
