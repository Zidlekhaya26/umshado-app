-- Migration: 014_create_seatings.sql
-- Creates a `seatings` table to store seating assignment payloads

-- Ensure uuid generation function is available (pgcrypto)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS seatings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  payload jsonb NOT NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seatings_created_at ON seatings (created_at);
