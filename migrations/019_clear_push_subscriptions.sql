-- Migration 019: Clear stale push subscriptions
-- 
-- Required because the initial implementation stored keys as standard base64
-- (btoa) instead of base64url. The web-push library requires base64url.
-- Clearing forces all browsers to re-subscribe with correct key encoding
-- the next time the user enables notifications.
--
-- Safe to run multiple times.

TRUNCATE TABLE public.push_subscriptions;
