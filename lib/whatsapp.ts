export function formatWhatsappLink(raw?: string | null): string | null {
  if (!raw) return null;

  try {
    const s = String(raw).trim();

    // If it's already a wa.me or whatsapp.com link, extract the phone
    const waMatch = s.match(/wa\.me\/(\+?\d+)/i);
    if (waMatch && waMatch[1]) return `https://wa.me/${waMatch[1].replace(/^\+/, '')}`;

    const sendMatch = s.match(/[?&]phone=(\+?\d+)/i);
    if (sendMatch && sendMatch[1]) return `https://wa.me/${sendMatch[1].replace(/^\+/, '')}`;

    // Strip non-digits
    const digits = s.replace(/[^\d+]/g, '');
    // Remove leading plus for wa.me
    const cleaned = digits.replace(/^\+/, '');
    if (cleaned.length === 0) return null;
    return `https://wa.me/${cleaned}`;
  } catch (e) {
    return null;
  }
}
