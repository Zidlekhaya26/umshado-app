'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';

/* ── Types ───────────────────────────────────────────────────── */
interface ChatMsg {
  role: 'user' | 'assistant' | 'system';
  content: string;
  ts: string;
}

/* ── Design tokens (match dashboard gold palette) ────────────── */
const G    = '#b8973e';
const G2   = '#8a6010';
const DARK = '#18100a';
const MID  = '#5c3d28';
const LITE = '#8a6e4a';
const BG   = '#faf7f2';

/* ── Suggested starter prompts ───────────────────────────────── */
const STARTERS = [
  '📅 Build me a planning timeline',
  '💰 Break down my budget by category',
  '📸 What should I look for in a photographer?',
  '📝 Help me write a vendor enquiry',
  '👗 When should I start dress shopping?',
  '🎵 How do I find the right DJ?',
];

/* ── Typing dots ─────────────────────────────────────────────── */
function TypingDots() {
  return (
    <div style={{ display: 'flex', gap: 4, padding: '10px 14px', alignItems: 'center' }}>
      {[0, 1, 2].map(i => (
        <div
          key={i}
          style={{
            width: 7, height: 7, borderRadius: '50%', background: LITE,
            animation: `amiDot 1.1s ease-in-out ${i * 0.18}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

/* ── Individual message bubble ───────────────────────────────── */
function Bubble({ msg }: { msg: ChatMsg }) {
  const isUser = msg.role === 'user';
  const isSystem = msg.role === 'system';

  if (isSystem) {
    return (
      <div style={{ textAlign: 'center', padding: '6px 0' }}>
        <span style={{ fontSize: 11, color: LITE, fontStyle: 'italic' }}>{msg.content}</span>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start',
        marginBottom: 2,
        animation: 'amiFadeUp 0.18s ease',
      }}
    >
      {/* Ami label on assistant messages */}
      {!isUser && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, marginLeft: 2 }}>
          <div style={{
            width: 20, height: 20, borderRadius: '50%',
            background: `linear-gradient(135deg, ${G}, ${G2})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10,
          }}>✨</div>
          <span style={{ fontSize: 10, fontWeight: 700, color: LITE, letterSpacing: 0.4 }}>Ami</span>
        </div>
      )}

      <div
        style={{
          maxWidth: '85%',
          padding: '10px 14px',
          borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
          background: isUser
            ? `linear-gradient(135deg, ${G}, ${G2})`
            : '#fff',
          color: isUser ? '#fff' : DARK,
          fontSize: 13.5,
          lineHeight: 1.55,
          boxShadow: isUser
            ? '0 3px 14px rgba(184,151,62,0.3)'
            : '0 2px 8px rgba(24,16,10,0.07)',
          border: isUser ? 'none' : '1.5px solid rgba(184,151,62,0.12)',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {msg.content}
      </div>

      <span style={{ fontSize: 10, color: LITE, opacity: 0.6, marginTop: 3, marginRight: isUser ? 3 : 0, marginLeft: isUser ? 0 : 3 }}>
        {new Date(msg.ts).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}
      </span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   AmiChat – main exported component
   Props let the parent (dashboard) pass live couple context
   so the first message can be contextual without an extra DB read.
───────────────────────────────────────────────────────────── */
interface AmiChatProps {
  /** Controlled open/close from parent */
  open: boolean;
  onClose: () => void;
  /** Optional context hints for display only – real context is built server-side */
  daysLeft?: number | null;
  partnerName?: string | null;
}

export default function AmiChat({ open, onClose, daysLeft, partnerName }: AmiChatProps) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [messagesUsed, setMessagesUsed]   = useState(0);
  const [dailyLimit] = useState(30);
  const [inputFocused, setInputFocused]   = useState(false);

  const endRef       = useRef<HTMLDivElement>(null);
  const inputRef     = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  /* ── Load existing history on open ──────────────────────── */
  useEffect(() => {
    if (!open || historyLoaded) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('ai_conversations')
        .select('messages')
        .eq('couple_id', user.id)
        .maybeSingle();

      if (data?.messages && Array.isArray(data.messages) && data.messages.length > 0) {
        setMessages(data.messages as ChatMsg[]);
      } else {
        // First time – inject welcome message
        const greeting = partnerName
          ? `Hi ${partnerName}! I'm Ami, your uMshado wedding planning assistant. 💍\n\n${daysLeft != null ? `You have ${daysLeft} days until the big day – exciting!` : `Let's get your planning on track.`}\n\nWhat can I help you with today?`
          : `Hi! I'm Ami, your uMshado wedding planning assistant. 💍\n\nI'm here to help with timelines, budgets, vendor advice, South African traditions, and anything else wedding-related.\n\nWhat would you like to plan today?`;

        setMessages([{ role: 'assistant', content: greeting, ts: new Date().toISOString() }]);
      }

      setHistoryLoaded(true);
    })();
  }, [open, historyLoaded, daysLeft, partnerName]);

  /* ── Scroll to bottom on new messages ───────────────────── */
  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open, loading]);

  /* ── Focus input when opened ─────────────────────────────── */
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 120);
  }, [open]);

  /* ── Send message ────────────────────────────────────────── */
  const send = useCallback(async (text?: string) => {
    const userText = (text ?? input).trim();
    if (!userText || loading) return;

    setInput('');
    const userMsg: ChatMsg = { role: 'user', content: userText, ts: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const res = await fetch('/api/ai/wedding-chat', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          Authorization:   `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ message: userText }),
      });

      const data = await res.json();

      if (res.status === 429) {
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: data.message ?? `You've reached today's limit of ${dailyLimit} messages. Come back tomorrow! ✨`,
            ts: new Date().toISOString(),
          },
        ]);
        return;
      }

      if (!res.ok) {
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: "Sorry, I couldn't connect just now. Please try again in a moment.",
            ts: new Date().toISOString(),
          },
        ]);
        return;
      }

      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: data.reply, ts: new Date().toISOString() },
      ]);
      setMessagesUsed(data.messagesUsed ?? 0);
    } catch (err) {
      console.error('[AmiChat] send error:', err);
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: "Something went wrong on my end. Please try again.",
          ts: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, dailyLimit]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const clearHistory = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;
    await fetch('/api/ai/wedding-chat', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body:    JSON.stringify({ message: '', clearHistory: true }),
    });
    setMessages([]);
    setHistoryLoaded(false);
  };

  const remaining = dailyLimit - messagesUsed;

  if (!open) return null;

  /* ── Render ──────────────────────────────────────────────── */
  return (
    <>
      <style>{`
        @keyframes amiDot {
          0%, 80%, 100% { transform: scale(0.65); opacity: 0.45; }
          40%           { transform: scale(1.0);  opacity: 1; }
        }
        @keyframes amiFadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes amiSlideUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .ami-panel { animation: amiSlideUp 0.28s cubic-bezier(0.34,1.56,0.64,1); }
        textarea:focus { outline: none; }
      `}</style>

      {/* ── Backdrop ──────────────────────────────────────── */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(24,16,10,0.45)',
          zIndex: 48,
          backdropFilter: 'blur(2px)',
        }}
      />

      {/* ── Panel ─────────────────────────────────────────── */}
      <div
        className="ami-panel"
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          maxWidth: 560, margin: '0 auto',
          height: '88svh',
          background: BG,
          borderRadius: '24px 24px 0 0',
          zIndex: 49,
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 -12px 48px rgba(24,16,10,0.22)',
        }}
      >
        {/* ── Header ────────────────────────────────────── */}
        <div style={{
          background: `linear-gradient(135deg, ${G} 0%, ${G2} 100%)`,
          padding: '16px 18px 18px',
          flexShrink: 0,
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Orb */}
          <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* Ami avatar */}
              <div style={{
                width: 42, height: 42, borderRadius: '50%',
                background: 'rgba(255,255,255,0.18)',
                border: '2px solid rgba(255,255,255,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20,
              }}>✨</div>
              <div>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#fff', fontFamily: 'Georgia, serif', lineHeight: 1 }}>Ami</p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>Your AI wedding planner</p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Usage pill */}
              {messagesUsed > 0 && (
                <div style={{ padding: '3px 10px', borderRadius: 20, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.15)' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>
                    {remaining} left today
                  </span>
                </div>
              )}
              {/* Clear */}
              {messages.filter(m => m.role !== 'system').length > 2 && (
                <button
                  onClick={clearHistory}
                  title="Clear chat history"
                  style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <svg width="13" height="13" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
              {/* Close */}
              <button
                onClick={onClose}
                style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <svg width="13" height="13" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* ── Messages ──────────────────────────────────── */}
        <div
          ref={containerRef}
          style={{
            flex: 1, overflowY: 'auto',
            padding: '16px 16px 8px',
            display: 'flex', flexDirection: 'column', gap: 10,
          }}
        >
          {/* Starter prompts – show only on first message */}
          {messages.length <= 1 && !loading && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 4, animation: 'amiFadeUp 0.3s ease 0.2s both' }}>
              {STARTERS.map(s => (
                <button
                  key={s}
                  onClick={() => send(s.replace(/^[^\s]+\s/, ''))}
                  style={{
                    padding: '7px 12px', borderRadius: 20,
                    background: '#fff', border: `1.5px solid rgba(184,151,62,0.22)`,
                    fontSize: 12, fontWeight: 600, color: MID, cursor: 'pointer',
                    lineHeight: 1.3, textAlign: 'left',
                    boxShadow: '0 1px 4px rgba(24,16,10,0.05)',
                    transition: 'all 0.12s',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {messages.map((m, i) => <Bubble key={i} msg={m} />)}

          {loading && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, animation: 'amiFadeUp 0.18s ease' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: `linear-gradient(135deg, ${G}, ${G2})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>✨</div>
              <div style={{ background: '#fff', borderRadius: '18px 18px 18px 4px', border: '1.5px solid rgba(184,151,62,0.12)', boxShadow: '0 2px 8px rgba(24,16,10,0.07)' }}>
                <TypingDots />
              </div>
            </div>
          )}

          <div ref={endRef} />
        </div>

        {/* ── Input bar ─────────────────────────────────── */}
        <div style={{
          padding: `10px 14px calc(10px + env(safe-area-inset-bottom))`,
          background: '#fff',
          borderTop: '1px solid rgba(184,151,62,0.12)',
          flexShrink: 0,
          display: 'flex', alignItems: 'flex-end', gap: 10,
        }}>
          <div style={{
            flex: 1,
            background: BG,
            borderRadius: 20,
            border: `1.5px solid ${inputFocused ? G : 'rgba(184,151,62,0.2)'}`,
            padding: '9px 14px',
            transition: 'border-color 0.15s',
            boxShadow: inputFocused ? `0 0 0 3px rgba(184,151,62,0.1)` : 'none',
          }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              disabled={loading}
              rows={1}
              placeholder="Ask Ami anything…"
              style={{
                width: '100%', background: 'none', border: 'none', resize: 'none',
                fontSize: 14, color: DARK, lineHeight: '20px',
                maxHeight: 90, overflowY: 'auto', padding: 0,
                fontFamily: "'DM Sans', system-ui, sans-serif",
              }}
            />
          </div>

          <button
            onClick={() => send()}
            disabled={loading || !input.trim()}
            style={{
              width: 40, height: 40, borderRadius: '50%', border: 'none', flexShrink: 0,
              background: input.trim() && !loading
                ? `linear-gradient(135deg, ${G}, ${G2})`
                : 'rgba(184,151,62,0.15)',
              color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: input.trim() && !loading ? 'pointer' : 'default',
              boxShadow: input.trim() && !loading ? '0 3px 12px rgba(184,151,62,0.35)' : 'none',
              transition: 'all 0.15s',
            }}
          >
            {loading ? (
              <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            ) : (
              <svg width="16" height="16" fill="none" stroke={input.trim() ? '#fff' : G} strokeWidth={2.2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
