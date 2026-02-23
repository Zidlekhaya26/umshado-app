import autoAssign, { Guest, Table } from '../server/utils/autoAssign';

test('respects avoid lists (guests who avoid each other not seated together)', () => {
  const guests: Guest[] = [
    { id: 'g1', name: 'Alice', avoid: ['g2'], rsvp: 'yes' },
    { id: 'g2', name: 'Bob', rsvp: 'yes' },
    { id: 'g3', name: 'Carol', rsvp: 'yes' }
  ];
  const tables: Table[] = [
    { id: 't1', capacity: 2 },
    { id: 't2', capacity: 2 }
  ];

  const out = autoAssign(guests, tables);
  // find table containing g1 and ensure g2 is not in same table
  const tWithG1 = out.find(t => t.seats?.includes('g1'))!;
  expect(tWithG1.seats).not.toContain('g2');
});

test('tries to separate VIPs across tables when possible', () => {
  const guests: Guest[] = [
    { id: 'v1', name: 'VIP1', vip: true, rsvp: 'yes' },
    { id: 'v2', name: 'VIP2', vip: true, rsvp: 'yes' },
    { id: 'g1', name: 'Guest', rsvp: 'yes' }
  ];
  const tables: Table[] = [
    { id: 't1', capacity: 2 },
    { id: 't2', capacity: 2 }
  ];

  const out = autoAssign(guests, tables);
  // VIPs should not be on the same table if space allows
  const vipTogether = out.some(t => t.seats && t.seats.includes('v1') && t.seats.includes('v2'));
  expect(vipTogether).toBe(false);
});
