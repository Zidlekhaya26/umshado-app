// Lightweight contacts bridge: prefer Web Contacts Picker, then attempt Capacitor native plugin if available.
export type PickedContact = { full_name: string; phone: string | null };

export async function pickContacts(): Promise<PickedContact[]> {
  // Web Contacts Picker
  const nav: any = typeof navigator !== 'undefined' ? (navigator as any) : null;
  if (nav && typeof nav.contacts !== 'undefined' && typeof nav.contacts.select === 'function') {
    try {
      const picker = await nav.contacts.select(['name', 'tel'], { multiple: true });
      return (picker || []).map((c: any) => ({ full_name: Array.isArray(c.name) ? c.name[0] : c.name || (c.names && c.names[0]) || 'Unknown', phone: Array.isArray(c.tel) ? c.tel[0] : c.tel || null }));
    } catch (e) {
      // user cancelled or permission denied — fallthrough to other approaches
      console.debug('Web contacts picker failed or cancelled', e);
    }
  }

  // Capacitor/native plugin attempt (best-effort).
  try {
    const cap = (globalThis as any).Capacitor;
    if (cap && cap.Plugins) {
      // Common plugin names: Contacts, ContactsPlugin, ContactsPicker
      const candidates = ['Contacts', 'ContactsPlugin', 'ContactsPicker'];
      for (const name of candidates) {
        const plugin = cap.Plugins[name];
        if (!plugin) continue;
        // Try several common method names
        const methodCandidates = ['getContacts', 'select', 'pick', 'get', 'pickContacts'];
        for (const m of methodCandidates) {
          if (typeof plugin[m] === 'function') {
            try {
              const res = await plugin[m]();
              // Normalize many possible shapes into our PickedContact array
              if (!res) return [];
              const arr = Array.isArray(res) ? res : (res.contacts || res.items || res.data || []);
              return (arr || []).map((c: any) => {
                const name = c.displayName || c.name || (Array.isArray(c.names) ? c.names[0] : undefined) || c.fullName || c.full_name || 'Unknown';
                const phone = Array.isArray(c.phoneNumbers) ? (c.phoneNumbers[0] && (c.phoneNumbers[0].value || c.phoneNumbers[0].number)) : (c.phone || c.tel || null);
                return { full_name: name, phone: phone || null };
              });
            } catch (e) {
              console.debug(`Plugin ${name}.${m} failed`, e);
              continue;
            }
          }
        }
      }
    }
  } catch (e) {
    console.debug('Capacitor plugin check failed', e);
  }

  // Nothing available — return empty array so caller can fallback to vCard upload.
  return [];
}
