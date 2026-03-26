-- Add rsvp_token column for guest RSVP verification
ALTER TABLE public.couple_guests
ADD COLUMN IF NOT EXISTS rsvp_token text;
