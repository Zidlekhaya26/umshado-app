-- ============================================================================
-- Quotes Engine Schema for uMshado
-- ============================================================================
-- This file creates tables for quotes, conversations, and messages
-- Run this in Supabase SQL Editor after vendors and packages are created
-- ============================================================================

-- ============================================================================
-- QUOTES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_ref text UNIQUE NOT NULL,
  couple_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  package_id uuid REFERENCES vendor_packages(id) ON DELETE SET NULL,
  package_name text,
  pricing_mode text CHECK (pricing_mode IN ('guest-based', 'time-based')) NOT NULL,
  guest_count int,
  hours int,
  base_from_price int NOT NULL,
  add_ons jsonb DEFAULT '[]'::jsonb,
  notes text,
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'negotiating', 'accepted', 'declined', 'expired')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================================
-- QUOTE LINE ITEMS TABLE (Optional but preferred)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.quote_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  label text NOT NULL,
  amount int NOT NULL,
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- CONVERSATIONS TABLE (For chat threading)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_message_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(couple_id, vendor_id)
);

-- ============================================================================
-- MESSAGES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_text text NOT NULL,
  quote_ref text,
  metadata jsonb DEFAULT '{}'::jsonb,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_quotes_couple_id ON quotes(couple_id);
CREATE INDEX IF NOT EXISTS idx_quotes_vendor_id ON quotes(vendor_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
CREATE INDEX IF NOT EXISTS idx_quotes_quote_ref ON quotes(quote_ref);

CREATE INDEX IF NOT EXISTS idx_quote_line_items_quote_id ON quote_line_items(quote_id);

CREATE INDEX IF NOT EXISTS idx_conversations_couple_id ON conversations(couple_id);
CREATE INDEX IF NOT EXISTS idx_conversations_vendor_id ON conversations(vendor_id);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- QUOTES POLICIES
-- ============================================================================

-- Couples can SELECT their own quotes
CREATE POLICY "Couples can view own quotes"
ON quotes
FOR SELECT
USING (auth.uid() = couple_id);

-- Vendors can SELECT quotes assigned to them
CREATE POLICY "Vendors can view assigned quotes"
ON quotes
FOR SELECT
USING (auth.uid() = vendor_id);

-- Couples can INSERT quotes
CREATE POLICY "Couples can create quotes"
ON quotes
FOR INSERT
WITH CHECK (auth.uid() = couple_id);

-- Vendors can UPDATE quote status
CREATE POLICY "Vendors can update quote status"
ON quotes
FOR UPDATE
USING (auth.uid() = vendor_id)
WITH CHECK (auth.uid() = vendor_id);

-- Couples can UPDATE their own quotes (for notes/add-ons)
CREATE POLICY "Couples can update own quotes"
ON quotes
FOR UPDATE
USING (auth.uid() = couple_id)
WITH CHECK (auth.uid() = couple_id);

-- ============================================================================
-- QUOTE LINE ITEMS POLICIES
-- ============================================================================

-- Users can view line items for quotes they have access to
CREATE POLICY "Users can view quote line items"
ON quote_line_items
FOR SELECT
USING (
  quote_id IN (
    SELECT id FROM quotes 
    WHERE couple_id = auth.uid() OR vendor_id = auth.uid()
  )
);

-- Couples can insert line items for their quotes
CREATE POLICY "Couples can add line items"
ON quote_line_items
FOR INSERT
WITH CHECK (
  quote_id IN (SELECT id FROM quotes WHERE couple_id = auth.uid())
);

-- ============================================================================
-- CONVERSATIONS POLICIES
-- ============================================================================

-- Users can view conversations they're part of
CREATE POLICY "Users can view own conversations"
ON conversations
FOR SELECT
USING (auth.uid() = couple_id OR auth.uid() = vendor_id);

-- Couples can create conversations
CREATE POLICY "Couples can create conversations"
ON conversations
FOR INSERT
WITH CHECK (auth.uid() = couple_id);

-- Users can update conversations they're part of
CREATE POLICY "Users can update own conversations"
ON conversations
FOR UPDATE
USING (auth.uid() = couple_id OR auth.uid() = vendor_id)
WITH CHECK (auth.uid() = couple_id OR auth.uid() = vendor_id);

-- ============================================================================
-- MESSAGES POLICIES
-- ============================================================================

-- Users can view messages in their conversations
CREATE POLICY "Users can view conversation messages"
ON messages
FOR SELECT
USING (
  conversation_id IN (
    SELECT id FROM conversations 
    WHERE couple_id = auth.uid() OR vendor_id = auth.uid()
  )
);

-- Users can send messages in their conversations
CREATE POLICY "Users can send messages"
ON messages
FOR INSERT
WITH CHECK (
  auth.uid() = sender_id AND
  conversation_id IN (
    SELECT id FROM conversations 
    WHERE couple_id = auth.uid() OR vendor_id = auth.uid()
  )
);

-- Users can update their own messages (for read status)
CREATE POLICY "Users can update own messages"
ON messages
FOR UPDATE
USING (
  conversation_id IN (
    SELECT id FROM conversations 
    WHERE couple_id = auth.uid() OR vendor_id = auth.uid()
  )
)
WITH CHECK (
  conversation_id IN (
    SELECT id FROM conversations 
    WHERE couple_id = auth.uid() OR vendor_id = auth.uid()
  )
);

-- ============================================================================
-- HELPER FUNCTION: Generate Quote Reference
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_quote_ref()
RETURNS text AS $$
DECLARE
  ref_date text;
  ref_code text;
  ref text;
BEGIN
  -- Format: Q-YYYYMMDD-XXXXX (e.g., Q-20260206-A3K9M)
  ref_date := TO_CHAR(NOW(), 'YYYYMMDD');
  ref_code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT || NOW()::TEXT) FROM 1 FOR 5));
  ref := 'Q-' || ref_date || '-' || ref_code;
  RETURN ref;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these to verify tables and RLS are set up:
-- 
-- SELECT tablename, rowsecurity 
-- FROM pg_tables 
-- WHERE schemaname = 'public' 
-- AND tablename IN ('quotes', 'quote_line_items', 'conversations', 'messages');
--
-- SELECT generate_quote_ref(); -- Test quote ref generation
--
-- Expected: All tables should show rowsecurity = true
-- ============================================================================
