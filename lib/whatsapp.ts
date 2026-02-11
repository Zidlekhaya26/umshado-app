export function formatWhatsappLink(raw?: string | null): string | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;

  // If already a full URL, return it (ensure https)
  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  // If starts with common whatsapp schemes, normalize to https
  if (/^(?:wa\.me|api\.whatsapp\.com|whatsapp:)/i.test(trimmed)) {
    return trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
  }

  // Extract digits only
  const digits = trimmed.replace(/[^0-9]/g, '');
  if (!digits) return null;

  let normalized = digits;
  // If starts with 0 and looks like a local SA number (10 digits), convert to +27
  if (/^0[0-9]{8,9}$/.test(normalized)) {
    normalized = `27${normalized.slice(1)}`;
  }

  // Return wa.me link
  return `https://wa.me/${normalized}`;
}
