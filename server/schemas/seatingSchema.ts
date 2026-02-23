import { z } from 'zod';

export const GuestSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  group: z.string().optional(),
  vip: z.boolean().optional(),
  rsvp: z.enum(['yes', 'no', 'pending']).optional(),
  avoid: z.array(z.string()).optional()
});

export const TableSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  capacity: z.number(),
  seats: z.array(z.string()).optional()
});

export const SeatingPayloadSchema = z.object({
  guests: z.array(GuestSchema),
  tables: z.array(TableSchema)
});

export type Guest = z.infer<typeof GuestSchema>;
export type Table = z.infer<typeof TableSchema>;
export type SeatingPayload = z.infer<typeof SeatingPayloadSchema>;

export default SeatingPayloadSchema;
