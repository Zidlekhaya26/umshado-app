import { handleAutoAssignPayload } from '../app/api/seating/auto-assign/route';

test('handler persists assignment when save=true and returns saved info', async () => {
  const insertMock = jest.fn().mockResolvedValue({ data: [{ id: '1' }], error: null });
  const fromMock = jest.fn(() => ({ insert: insertMock }));
  const fakeClient = { from: fromMock };

  const payload = {
    guests: [ { id: 'g1', rsvp: 'yes' }, { id: 'g2', rsvp: 'yes' } ],
    tables: [ { id: 't1', capacity: 1 }, { id: 't2', capacity: 1 } ]
  };

  const res = await handleAutoAssignPayload(payload, { save: true, supabaseClient: fakeClient });
  expect(res.status).toBe(200);
  expect(fromMock).toHaveBeenCalledWith('seatings');
  expect(insertMock).toHaveBeenCalled();
  expect(res.saved).toBeDefined();
  expect(res.saved.data[0].id).toBe('1');
});
