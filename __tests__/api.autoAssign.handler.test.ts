import { handleAutoAssignPayload } from '../app/api/seating/auto-assign/route';

test('handler returns 400 for invalid payload', async () => {
  const res = await handleAutoAssignPayload({});
  expect(res.status).toBe(400);
  expect(res.error).toBeDefined();
});

test('handler returns assigned tables for valid payload', async () => {
  const payload = {
    guests: [ { id: 'g1', rsvp: 'yes' }, { id: 'g2', rsvp: 'yes' } ],
    tables: [ { id: 't1', capacity: 1 }, { id: 't2', capacity: 1 } ]
  };
  const res = await handleAutoAssignPayload(payload);
  expect(res.status).toBe(200);
  expect(Array.isArray(res.tables)).toBe(true);
  const assigned = res.tables.reduce((s: number, t: any) => s + (t.seats?.length ?? 0), 0);
  expect(assigned).toBe(2);
});

test('handler rejects guests missing id according to schema', async () => {
  const payload = {
    guests: [ { name: 'NoId', rsvp: 'yes' } ],
    tables: [ { id: 't1', capacity: 1 } ]
  };
  const res = await handleAutoAssignPayload(payload);
  expect(res.status).toBe(400);
});
