-- Migration: add composite index for messages to speed up conversation paging
-- Run: psql -f migrations/015_add_idx_messages_conversation_created_at.sql

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created_at ON public.messages(conversation_id, created_at DESC);
