-- Migration 020: Wedding website customization
-- Adds wedding_theme, gift_enabled, gift_items to couples table

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'couples' AND column_name = 'wedding_theme'
  ) THEN
    ALTER TABLE public.couples ADD COLUMN wedding_theme text DEFAULT 'champagne';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'couples' AND column_name = 'gift_enabled'
  ) THEN
    ALTER TABLE public.couples ADD COLUMN gift_enabled boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'couples' AND column_name = 'gift_message'
  ) THEN
    ALTER TABLE public.couples ADD COLUMN gift_message text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'couples' AND column_name = 'gift_items'
  ) THEN
    -- JSON array: [{ id, title, description, amount, emoji }]
    ALTER TABLE public.couples ADD COLUMN gift_items jsonb DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'couples' AND column_name = 'payfast_merchant_id'
  ) THEN
    ALTER TABLE public.couples ADD COLUMN payfast_merchant_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'couples' AND column_name = 'payfast_merchant_key'
  ) THEN
    ALTER TABLE public.couples ADD COLUMN payfast_merchant_key text;
  END IF;
END $$;
