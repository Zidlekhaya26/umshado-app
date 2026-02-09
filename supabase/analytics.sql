-- Vendor analytics events and daily stats

create table if not exists public.vendor_events (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in ('profile_view','save_vendor','quote_requested','message_started','package_view')),
  meta jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.vendor_stats_daily (
  vendor_id uuid not null,
  day date not null,
  profile_views int default 0,
  saves int default 0,
  quotes int default 0,
  messages int default 0,
  primary key (vendor_id, day)
);

alter table public.vendor_events enable row level security;
alter table public.vendor_stats_daily enable row level security;

create policy "vendor can read own events" on public.vendor_events
  for select
  using (
    exists (
      select 1
      from public.vendors v
      where v.id = vendor_events.vendor_id
        and (v.user_id = auth.uid() or v.id = auth.uid())
    )
  );

create policy "authenticated can insert vendor events" on public.vendor_events
  for insert
  with check (
    auth.role() = 'authenticated'
  );

create policy "vendor can read own stats" on public.vendor_stats_daily
  for select
  using (
    exists (
      select 1
      from public.vendors v
      where v.id = vendor_stats_daily.vendor_id
        and (v.user_id = auth.uid() or v.id = auth.uid())
    )
  );

create or replace function public.upsert_vendor_stats_daily()
returns trigger
language plpgsql
security definer
as $$
declare
  day_date date := (new.created_at at time zone 'utc')::date;
begin
  insert into public.vendor_stats_daily (vendor_id, day, profile_views, saves, quotes, messages)
  values (
    new.vendor_id,
    day_date,
    case when new.event_type = 'profile_view' then 1 else 0 end,
    case when new.event_type = 'save_vendor' then 1 else 0 end,
    case when new.event_type = 'quote_requested' then 1 else 0 end,
    case when new.event_type = 'message_started' then 1 else 0 end
  )
  on conflict (vendor_id, day) do update set
    profile_views = vendor_stats_daily.profile_views + (case when new.event_type = 'profile_view' then 1 else 0 end),
    saves = vendor_stats_daily.saves + (case when new.event_type = 'save_vendor' then 1 else 0 end),
    quotes = vendor_stats_daily.quotes + (case when new.event_type = 'quote_requested' then 1 else 0 end),
    messages = vendor_stats_daily.messages + (case when new.event_type = 'message_started' then 1 else 0 end);

  return new;
end;
$$;

create trigger trg_vendor_events_stats
after insert on public.vendor_events
for each row
execute function public.upsert_vendor_stats_daily();

-- Marketplace activity scores (last 7 days) with security definer
create or replace function public.get_vendor_activity_7d()
returns table (
  vendor_id uuid,
  profile_views int,
  quotes int,
  messages int,
  saves int,
  activity_score int
)
language sql
security definer
as $$
  select
    vs.vendor_id,
    coalesce(sum(vs.profile_views), 0)::int as profile_views,
    coalesce(sum(vs.quotes), 0)::int as quotes,
    coalesce(sum(vs.messages), 0)::int as messages,
    coalesce(sum(vs.saves), 0)::int as saves,
    (coalesce(sum(vs.profile_views), 0)
     + coalesce(sum(vs.quotes), 0) * 3
     + coalesce(sum(vs.messages), 0) * 2
     + coalesce(sum(vs.saves), 0))::int as activity_score
  from public.vendor_stats_daily vs
  where vs.day >= (current_date - 6)
  group by vs.vendor_id;
$$;

grant execute on function public.get_vendor_activity_7d() to anon, authenticated;
