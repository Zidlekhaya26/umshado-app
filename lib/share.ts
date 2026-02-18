export type SharePayload = {
  title: string;
  text?: string;
  url: string;
};

export async function shareLink(payload: SharePayload): Promise<{ ok: boolean; usedNative: boolean }> {
  try {
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      // @ts-ignore
      await (navigator as any).share(payload);
      return { ok: true, usedNative: true };
    }
    return { ok: false, usedNative: false };
  } catch {
    // user cancelled or share failed
    return { ok: false, usedNative: true };
  }
}

export function buildWhatsAppLink(message: string, url: string) {
  const text = `${message}\n${url}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
