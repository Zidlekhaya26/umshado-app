-- ============================================================================
-- Migration 006: Fix Conversations — Deduplicate & Harden
-- ============================================================================
-- This migration:
--   1. Merges duplicate conversations (same couple_id + vendor_id)
--   2. Re-applies the UNIQUE(couple_id, vendor_id) constraint
--   3. Updates RLS so vendors can ALSO create conversations (for quote replies)
--   4. Adds a helper to safely find-or-create a conversation
-- ============================================================================

-- ============================================================================
-- STEP 1: Deduplicate conversations
-- ============================================================================
-- Keep the oldest conversation per (couple_id, vendor_id) pair.
-- Move all messages from duplicate conversations into the kept one, then delete.

DO $$
DECLARE
  rec   RECORD;
  kept  uuid;
BEGIN
  -- Find (couple_id, vendor_id) pairs that have more than one conversation
  FOR rec IN
    SELECT couple_id, vendor_id
    FROM   conversations
    GROUP  BY couple_id, vendor_id
    HAVING COUNT(*) > 1
  LOOP
    -- Pick the oldest conversation as the keeper
    SELECT id INTO kept
    FROM   conversations
    WHERE  couple_id = rec.couple_id
      AND  vendor_id = rec.vendor_id
    ORDER  BY created_at ASC
    LIMIT  1;

    -- Re-point messages from duplicate conversations to the kept one
    UPDATE messages
    SET    conversation_id = kept
    WHERE  conversation_id IN (
      SELECT id FROM conversations
      WHERE  couple_id = rec.couple_id
        AND  vendor_id = rec.vendor_id
        AND  id <> kept
    );

    -- Re-point message_attachments from duplicate conversations to the kept one
    UPDATE message_attachments
    SET    conversation_id = kept
    WHERE  conversation_id IN (
      SELECT id FROM conversations
      WHERE  couple_id = rec.couple_id
        AND  vendor_id = rec.vendor_id
        AND  id <> kept
    );

    -- Delete duplicate conversations
    DELETE FROM conversations
    WHERE  couple_id = rec.couple_id
      AND  vendor_id = rec.vendor_id
      AND  id <> kept;

    -- Update last_message_at on the kept conversation
    UPDATE conversations
    SET    last_message_at = COALESCE(
             (SELECT MAX(created_at) FROM messages WHERE conversation_id = kept),
             conversations.created_at
           )
    WHERE  id = kept;

    RAISE NOTICE 'Merged conversations for couple % + vendor % → kept %',
                 rec.couple_id, rec.vendor_id, kept;
  END LOOP;
END;
$$;

-- ============================================================================
-- STEP 2: Ensure UNIQUE constraint exists
-- ============================================================================
-- This is idempotent — if the constraint already exists, it does nothing.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'conversations_couple_id_vendor_id_key'
      AND conrelid = 'public.conversations'::regclass
  ) THEN
    ALTER TABLE public.conversations
      ADD CONSTRAINT conversations_couple_id_vendor_id_key UNIQUE (couple_id, vendor_id);
    RAISE NOTICE 'Added UNIQUE(couple_id, vendor_id) constraint on conversations';
  ELSE
    RAISE NOTICE 'UNIQUE(couple_id, vendor_id) constraint already exists';
  END IF;
END;
$$;

-- ============================================================================
-- STEP 3: Update RLS — Allow vendors to create conversations too
-- ============================================================================
-- Previously only couples could INSERT. Vendors need to create a conversation
-- when replying to a quote request that has no conversation yet.

-- Drop the old couple-only INSERT policy
DROP POLICY IF EXISTS "Couples can create conversations" ON conversations;

-- Create a new INSERT policy that allows both couples and vendors
CREATE POLICY "Users can create conversations"
ON conversations
FOR INSERT
WITH CHECK (
  auth.uid() = couple_id OR auth.uid() = vendor_id
);

-- ============================================================================
-- STEP 4: Helper function — find or create a conversation
-- ============================================================================
-- Returns the conversation ID for a given (couple_id, vendor_id) pair.
-- Creates the conversation if it doesn't exist.

CREATE OR REPLACE FUNCTION find_or_create_conversation(
  p_couple_id uuid,
  p_vendor_id uuid
)
RETURNS uuid AS $$
DECLARE
  v_id uuid;
BEGIN
  -- Try to find existing
  SELECT id INTO v_id
  FROM   conversations
  WHERE  couple_id = p_couple_id
    AND  vendor_id = p_vendor_id;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  -- Insert new
  INSERT INTO conversations (couple_id, vendor_id)
  VALUES (p_couple_id, p_vendor_id)
  ON CONFLICT (couple_id, vendor_id) DO NOTHING
  RETURNING id INTO v_id;

  -- If ON CONFLICT hit, re-fetch
  IF v_id IS NULL THEN
    SELECT id INTO v_id
    FROM   conversations
    WHERE  couple_id = p_couple_id
      AND  vendor_id = p_vendor_id;
  END IF;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION find_or_create_conversation(uuid, uuid) TO authenticated;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Run after migration to verify:
--
-- 1. No duplicate conversations:
--    SELECT couple_id, vendor_id, COUNT(*) 
--    FROM conversations 
--    GROUP BY couple_id, vendor_id 
--    HAVING COUNT(*) > 1;
--    -- Expected: 0 rows
--
-- 2. Constraint exists:
--    SELECT conname FROM pg_constraint 
--    WHERE conrelid = 'public.conversations'::regclass 
--    AND contype = 'u';
--    -- Expected: conversations_couple_id_vendor_id_key
--
-- 3. RLS policies:
--    SELECT policyname, cmd FROM pg_policies 
--    WHERE tablename = 'conversations';
--    -- Expected: "Users can create conversations" for INSERT
--
-- 4. Test find_or_create:
--    SELECT find_or_create_conversation(
--      '00000000-0000-0000-0000-000000000001'::uuid,
--      '00000000-0000-0000-0000-000000000002'::uuid
--    );
-- ============================================================================
