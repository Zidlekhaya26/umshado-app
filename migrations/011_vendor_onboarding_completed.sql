-- Add onboarding completion flag for vendors
alter table public.vendors
add column if not exists onboarding_completed boolean not null default false;
