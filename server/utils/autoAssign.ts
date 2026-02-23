export type Guest = {
  id: string;
  name?: string;
  group?: string;
  vip?: boolean;
  rsvp?: 'yes' | 'no' | 'pending';
  avoid?: string[];
};

export type Table = {
  id: string;
  name?: string;
  capacity: number;
  seats?: string[]; // guest ids
};

/**
 * Greedy auto-assign with simple constraints:
 * - ignores guests with rsvp === 'no'
 * - places VIPs first, trying to separate them across tables
 * - keeps groups together when possible
 * - respects `avoid` lists (guest.avoid contains guest ids that must NOT share a table)
 */
export function autoAssign(guests: Guest[], tablesInput: Table[]): Table[] {
  const tables: Table[] = tablesInput.map(t => ({ ...t, seats: Array.isArray(t.seats) ? [...t.seats] : [] }));

  // helper maps
  const byId = new Map<string, Guest>();
  for (const g of guests) byId.set(g.id, g);

  // filter out RSVPed 'no'
  const available = guests.filter(g => g.rsvp !== 'no');

  // Keep track of assigned guest ids
  const assigned = new Set<string>();

  // 1) Place VIPs trying to separate them across tables when possible
  const vips = available.filter(g => g.vip);
  for (const vip of vips) {
    if (assigned.has(vip.id)) continue;
    let target = tables.find(t => (t.seats!.length < t.capacity) && !t.seats!.some(sid => byId.get(sid)?.vip));
    if (!target) target = tables.find(t => t.seats!.length < t.capacity);
    if (!target) continue;
    target.seats!.push(vip.id);
    assigned.add(vip.id);
  }

  // 2) Group guests by group key preserving insertion order
  const groups: Record<string, Guest[]> = {};
  for (const g of available) {
    if (assigned.has(g.id)) continue;
    const key = g.group ?? '_ungrouped';
    if (!groups[key]) groups[key] = [];
    groups[key].push(g);
  }

  // function to check if a guest can sit at a table (avoid constraints)
  function canSitAt(guest: Guest, table: Table) {
    if ((table.seats!.length) >= table.capacity) return false;
    for (const occ of table.seats!) {
      // guest requests to avoid occupant
      if (guest.avoid && guest.avoid.includes(occ)) return false;
      // occupant may request to avoid this guest
      const occGuest = byId.get(occ);
      if (occGuest && occGuest.avoid && occGuest.avoid.includes(guest.id)) return false;
    }
    return true;
  }

  // 3) Place non-VIP guests group-by-group, prefer tables with same group members
  for (const group of Object.values(groups)) {
    for (const guest of group) {
      if (assigned.has(guest.id)) continue;
      let target = tables.find(t => t.seats!.some(sid => byId.get(sid)?.group === guest.group) && canSitAt(guest, t));
      if (!target) target = tables.find(t => canSitAt(guest, t));
      if (!target) continue;
      target.seats!.push(guest.id);
      assigned.add(guest.id);
    }
  }

  return tables;
}

export default autoAssign;
