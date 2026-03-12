-- =============================================================
-- uMshado Migration 024 – AI Wedding Chat
-- Run in: Supabase Dashboard → SQL Editor
-- =============================================================

-- ── 1. ai_conversations ──────────────────────────────────────
--    One row per couple. Stores full message history as JSONB.
--    Each message: { role: 'user'|'assistant', content: string, ts: ISO string }

CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id     uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  messages      jsonb        NOT NULL DEFAULT '[]'::jsonb,
  message_count integer      NOT NULL DEFAULT 0,
  created_at    timestamptz  NOT NULL DEFAULT now(),
  updated_at    timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT ai_conversations_couple_unique UNIQUE (couple_id)
);

ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Couples read own ai_conversation"
  ON public.ai_conversations FOR SELECT
  USING (auth.uid() = couple_id);

CREATE POLICY "Couples insert own ai_conversation"
  ON public.ai_conversations FOR INSERT
  WITH CHECK (auth.uid() = couple_id);

CREATE POLICY "Couples update own ai_conversation"
  ON public.ai_conversations FOR UPDATE
  USING (auth.uid() = couple_id);

-- Auto-bump updated_at on every change
CREATE OR REPLACE FUNCTION public.set_ai_conv_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ai_conv_updated_at ON public.ai_conversations;
CREATE TRIGGER trg_ai_conv_updated_at
  BEFORE UPDATE ON public.ai_conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_ai_conv_updated_at();

CREATE INDEX IF NOT EXISTS idx_ai_conversations_couple_id
  ON public.ai_conversations (couple_id);


-- ── 2. ai_usage ──────────────────────────────────────────────
--    Daily usage tracking per couple for rate-limiting + future billing tiers.

CREATE TABLE IF NOT EXISTS public.ai_usage (
  id             uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id      uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date           date    NOT NULL DEFAULT CURRENT_DATE,
  messages_sent  integer NOT NULL DEFAULT 0,
  tokens_used    integer NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_usage_couple_date_unique UNIQUE (couple_id, date)
);

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

-- Couples can see their own usage
CREATE POLICY "Couples read own ai_usage"
  ON public.ai_usage FOR SELECT
  USING (auth.uid() = couple_id);

-- All writes go through the API route using service role – no client insert policy needed.

CREATE INDEX IF NOT EXISTS idx_ai_usage_couple_date
  ON public.ai_usage (couple_id, date);
