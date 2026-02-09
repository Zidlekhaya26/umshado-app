/**
 * Beta gate helper.
 *
 * When NEXT_PUBLIC_BETA_INVITE_ONLY is "true" the app runs in
 * private-beta mode:
 *   – public sign-up is disabled
 *   – the /auth landing shows "Invite Required"
 *   – unauthenticated visitors are pushed to /auth
 *   – a /request-access page lets people apply
 *
 * Flip the env-var to "false" (or remove it) to open registration.
 */

export const BETA_INVITE_ONLY =
  process.env.NEXT_PUBLIC_BETA_INVITE_ONLY === 'true';
