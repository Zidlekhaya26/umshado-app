import { formatWhatsappLink } from './whatsapp';
import { getPublicBaseUrl } from './publicUrl';

export function generateWhatsappInviteLink(opts: {
  phone?: string | null;
  guestId: string;
  coupleName?: string | null;
  guestName?: string | null;
  token?: string | null;
  coupleDate?: string | null; // ISO date/time string
  coupleVenue?: string | null;
}) {
  const { phone, guestId, coupleName, guestName, token } = opts;
  const base = getPublicBaseUrl();
  const { coupleDate, coupleVenue } = opts;
  const rsvp = `${base}/rsvp/${guestId}${token ? `?t=${encodeURIComponent(token)}&view=card` : ''}`;

  // Prefer an explicit couple name when available. If guestName is provided,
  // address them directly. Use a celebratory emoji and clear RSVP link.
  const host = coupleName ? coupleName : 'You';
  const greeting = guestName ? `Hi ${guestName},\n\n` : '';

  // Optionally include date and venue when available
  let eventLine = '';
  try {
    if (coupleDate) {
      const d = new Date(coupleDate);
      if (!isNaN(d.getTime())) {
        // human-friendly date (date-only, no time)
        eventLine += `When: ${d.toLocaleString(undefined, { dateStyle: 'long' })}`;
      }
    }
  } catch (e) {
    // ignore formatting errors
  }
  if (coupleVenue) {
    eventLine += (eventLine ? ' — ' : '') + `Where: ${coupleVenue}`;
  }

  const message = `${greeting}${host} invites you to their wedding 💍${eventLine ? `\n${eventLine}` : ''}\nView your invite & RSVP:\n${rsvp}`.trim();

  if (!phone) return rsvp;

  const wa = formatWhatsappLink(phone);
  if (!wa) return rsvp;

  return `${wa}?text=${encodeURIComponent(message)}`;
}
