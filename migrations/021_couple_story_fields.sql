-- Migration 021: Add couple story fields to couples table
-- Run in Supabase SQL editor

ALTER TABLE couples
  ADD COLUMN IF NOT EXISTS how_we_met     text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS proposal_story text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS couple_message text DEFAULT NULL;

COMMENT ON COLUMN couples.how_we_met     IS 'How the couple met — displayed on wedding website Our Story tab';
COMMENT ON COLUMN couples.proposal_story IS 'The proposal story — displayed on wedding website Our Story tab';
COMMENT ON COLUMN couples.couple_message IS 'A personal note to guests — displayed as a pull quote on the wedding website';
