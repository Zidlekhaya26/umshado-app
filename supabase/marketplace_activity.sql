-- Marketplace activity scoring helper
-- Aggregates vendor events over the last 7 days

CREATE OR REPLACE FUNCTION public.get_vendor_activity_7d()
RETURNS TABLE(
  vendor_id uuid,
  profile_views int,
  quotes int,
  messages int,
  saves int,
  activity_score int
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    ve.vendor_id,
    SUM(CASE WHEN ve.event_type = 'profile_view' THEN 1 ELSE 0 END) AS profile_views,
    SUM(CASE WHEN ve.event_type = 'quote_requested' THEN 1 ELSE 0 END) AS quotes,
    SUM(CASE WHEN ve.event_type = 'message_started' THEN 1 ELSE 0 END) AS messages,
    SUM(CASE WHEN ve.event_type = 'save_vendor' THEN 1 ELSE 0 END) AS saves,
    (SUM(CASE WHEN ve.event_type = 'profile_view' THEN 1 ELSE 0 END)
     + SUM(CASE WHEN ve.event_type = 'quote_requested' THEN 1 ELSE 0 END) * 2
     + SUM(CASE WHEN ve.event_type = 'message_started' THEN 1 ELSE 0 END)
     + SUM(CASE WHEN ve.event_type = 'save_vendor' THEN 1 ELSE 0 END) * 2) AS activity_score
  FROM public.vendor_events ve
  WHERE ve.created_at >= (now() - interval '7 days')
  GROUP BY ve.vendor_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_vendor_activity_7d() TO authenticated;
