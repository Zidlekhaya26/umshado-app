'use client';

import { usePushNotifications } from '@/hooks/usePushNotifications';

/**
 * Toggle row for the Settings page — lets users enable/disable
 * push notifications after the initial prompt.
 */
export default function PushNotificationsToggle() {
  const { permission, isSubscribed, isLoading, subscribe, unsubscribe } = usePushNotifications();

  // Hide if browser doesn't support push
  if (permission === 'unsupported') return null;

  const handleToggle = async () => {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  };

  const statusText =
    permission === 'denied'
      ? 'Blocked in browser settings'
      : isSubscribed
      ? 'You\'ll be notified even when the app is closed'
      : 'Enable to receive alerts when the app is closed';

  return (
    <div className="px-4 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: isSubscribed ? 'rgba(107,31,58,0.12)' : '#f3f4f6' }}>
            <svg
              className="w-5 h-5"
              style={{ color: isSubscribed ? '#6b1f3a' : '#9ca3af' }}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Push Notifications</p>
            <p className="text-xs text-gray-500">Messages, quotes &amp; RSVPs</p>
          </div>
        </div>

        {permission === 'denied' ? (
          <span className="text-xs text-red-500 font-medium max-w-[100px] text-right">Blocked</span>
        ) : (
          <button
            onClick={handleToggle}
            disabled={isLoading}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors disabled:opacity-50 ${
              isSubscribed ? 'bg-purple-600' : 'bg-gray-300'
            }`}
            aria-label={isSubscribed ? 'Disable push notifications' : 'Enable push notifications'}
          >
            {isLoading ? (
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              </span>
            ) : (
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  isSubscribed ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            )}
          </button>
        )}
      </div>
      <p className="text-[11px] text-gray-400 mt-2 leading-relaxed pl-[52px]">
        {statusText}
        {permission === 'denied' && (
          <span className="block mt-0.5">
            Go to your browser settings to re-enable notifications for this site.
          </span>
        )}
      </p>
    </div>
  );
}
