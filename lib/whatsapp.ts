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

/**
 * Normalize an international phone number.
 * Returns a string like "+27831234567" or null if invalid.
 */
export function normalizeInternationalPhone(raw?: string | null): string | null {
  if (!raw) return null;
  const s = String(raw).trim();

  // If it's a wa.me link or URL with phone=, extract the phone
  const waMatch = s.match(/wa\.me\/(\+?\d+)/i);
  if (waMatch?.[1]) return `+${waMatch[1].replace(/^\+/, '')}`;
  const sendMatch = s.match(/[?&]phone=(\+?\d+)/i);
  if (sendMatch?.[1]) return `+${sendMatch[1].replace(/^\+/, '')}`;

  // Keep only digits and leading +
  const cleaned = s.replace(/[^\d+]/g, '');
  // Must start with + followed by 6-15 digits (E.164-ish)
  const m = cleaned.match(/^\+(\d{6,15})$/);
  if (!m) return null;
  return `+${m[1]}`;
}
