export function formatWhatsappLink(raw?: string | null): string | null {
  if (!raw) return null;

  const s = String(raw).trim();

  // If it's already a wa.me link, extract the phone
  const waMatch = s.match(/wa\.me\/(\+?\d+)/i);
  if (waMatch?.[1]) return `https://wa.me/${waMatch[1].replace(/^\+/, '')}`;

  // If it's a send?phone= link
  const sendMatch = s.match(/[?&]phone=(\+?\d+)/i);
  if (sendMatch?.[1]) return `https://wa.me/${sendMatch[1].replace(/^\+/, '')}`;

  // Keep digits and leading + only, then strip non-digits for final
  const digits = s.replace(/[^\d+]/g, '');
  const cleaned = digits.replace(/^\+/, '');
  const finalDigits = cleaned.replace(/\D/g, '');
  if (!finalDigits) return null;

  return `https://wa.me/${finalDigits}`;
}
