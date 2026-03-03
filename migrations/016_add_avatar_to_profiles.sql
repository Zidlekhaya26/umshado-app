-- Add avatar_url column to profiles so InviteCard can reference it
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS avatar_url text;
