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
  nudge?: boolean; // true = reminder tone, false/undefined = initial invite
}) {
  const { phone, guestId, coupleName, guestName, token, nudge } = opts;
  const base = getPublicBaseUrl();
  const { coupleDate, coupleVenue } = opts;
  const rsvp = `${base}/rsvp/${guestId}${token ? `?t=${encodeURIComponent(token)}&view=card` : ''}`;

  const host = coupleName ? coupleName : 'the couple';
  const greeting = guestName ? `Hi ${guestName}! 👋\n\n` : '';

  // Optionally include date and venue when available
  let dateLine = '';
  let venueLine = '';
  try {
    if (coupleDate) {
      const d = new Date(coupleDate);
      if (!isNaN(d.getTime())) {
        dateLine = `📅 ${d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`;
      }
    }
  } catch (e) {
    // ignore formatting errors
  }
  if (coupleVenue) {
    venueLine = `📍 ${coupleVenue}`;
  }

  const eventDetails = [dateLine, venueLine].filter(Boolean).join('\n');

  const message = nudge
    ? `${greeting}Just a friendly reminder 💌\n\n${host} are still waiting on your RSVP! We'd love to know if you can make it.\n\nRespond here 👇\n${rsvp}`.trim()
    : `${greeting}💍 *${host}* invite you to celebrate their wedding!\n\n${eventDetails ? `${eventDetails}\n\n` : ''}View your personal invite & RSVP 👇\n${rsvp}`.trim();

  if (!phone) return rsvp;

  const wa = formatWhatsappLink(phone);
  if (!wa) return rsvp;

  return `${wa}?text=${encodeURIComponent(message)}`;
}
