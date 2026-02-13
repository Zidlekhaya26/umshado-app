import { formatWhatsappLink } from './whatsapp';

export function generateWhatsappInviteLink(opts: { phone?: string | null; guestId: string; coupleName?: string | null; }) {
  const { phone, guestId, coupleName } = opts;
  const base = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_VERCEL_URL || 'http://localhost:3000').replace(/\/$/, '');
  const rsvp = `${base}/rsvp/${guestId}`;

  // Fallback plain link if phone not available
  const message = `You're invited! Please RSVP here: ${rsvp}`;

  if (!phone) return `${rsvp}`;

  const wa = formatWhatsappLink(phone);
  if (!wa) return `${rsvp}`;

  const encoded = encodeURIComponent(`${coupleName ? `${coupleName} invites you.` : ''} ${message}`.trim());
  return `${wa}?text=${encoded}`;
}
