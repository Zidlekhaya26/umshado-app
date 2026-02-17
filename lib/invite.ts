import { formatWhatsappLink } from './whatsapp';
import { getPublicBaseUrl } from './publicUrl';

export function generateWhatsappInviteLink(opts: {
  phone?: string | null;
  guestId: string;
  coupleName?: string | null;
  guestName?: string | null;
  token?: string | null;
}) {
  const { phone, guestId, coupleName, guestName, token } = opts;
  const base = getPublicBaseUrl();
  const rsvp = `${base}/rsvp/${guestId}${token ? `?t=${encodeURIComponent(token)}` : ''}`;

  // Prefer an explicit couple name when available. If guestName is provided,
  // address them directly. Use a celebratory emoji and clear RSVP link.
  const host = coupleName ? coupleName : 'You';
  const greeting = guestName ? `Hi ${guestName},\n\n` : '';
  const message = `${greeting}${host} invite you to their wedding 💍\nPlease RSVP here:\n${rsvp}`.trim();

  if (!phone) return rsvp;

  const wa = formatWhatsappLink(phone);
  if (!wa) return rsvp;

  return `${wa}?text=${encodeURIComponent(message)}`;
}
