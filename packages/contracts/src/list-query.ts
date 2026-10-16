import { z } from 'zod';
const common = {
  q: z.string().trim().max(200).default(''),
  direction: z.enum(['asc', 'desc']).default('desc'),
};
export const operationListQuerySchema = z
  .object({
    ...common,
    sort: z.enum(['reference', 'name', 'createdAt']).default('createdAt'),
  })
  .strict();
export const agreementListQuerySchema = z
  .object({
    ...common,
    sort: z
      .enum([
        'provider',
        'title',
        'service',
        'validFrom',
        'validUntil',
        'createdAt',
      ])
      .default('createdAt'),
  })
  .strict();
