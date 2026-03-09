-- Migration 019: Auto-send Push Notifications Trigger
-- Creates a Postgres function + trigger that automatically sends push notifications
-- when a new notification record is inserted.

-- Create or replace the function that sends push notifications
CREATE OR REPLACE FUNCTION send_push_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  subscription RECORD;
  payload jsonb;
  response text;
BEGIN
  -- Build the push notification payload
  payload := jsonb_build_object(
    'title', NEW.title,
    'body', NEW.body,
    'data', jsonb_build_object(
      'notificationId', NEW.id::text,
      'link', NEW.link,
      'type', NEW.type
    )
  );

  -- Loop through all active push subscriptions for this user
  FOR subscription IN 
    SELECT endpoint, p256dh, auth 
    FROM push_subscriptions 
    WHERE user_id = NEW.user_id
  LOOP
    BEGIN
      -- Use http extension to call the push API
      -- Note: This requires pg_net or http extension to be enabled
      SELECT content INTO response
      FROM http((
        'POST',
        current_setting('app.settings.app_url', true) || '/api/push/send',
        ARRAY[http_header('Content-Type', 'application/json')],
        'application/json',
        jsonb_build_object(
          'subscription', jsonb_build_object(
            'endpoint', subscription.endpoint,
            'keys', jsonb_build_object(
              'p256dh', subscription.p256dh,
              'auth', subscription.auth
            )
          ),
          'payload', payload
        )::text
      )::http_request);
      
      RAISE LOG 'Push notification sent to endpoint: %', subscription.endpoint;
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG 'Failed to send push notification: %', SQLERRM;
    END;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_send_push_on_notification ON notifications;

CREATE TRIGGER trigger_send_push_on_notification
  AFTER INSERT ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION send_push_notification();

COMMENT ON FUNCTION send_push_notification() IS 
  'Automatically sends push notifications to all subscribed devices when a notification is inserted';
