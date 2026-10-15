import { z } from 'zod';
export const readinessSchema = z.object({
  status: z.enum(['ready', 'not_ready']),
  checks: z.record(z.string(), z.enum(['up', 'down'])),
});
export type Readiness = z.infer<typeof readinessSchema>;
export const platformJobSchema = z.object({
  type: z.literal('platform.ping'),
  correlationId: z.string().uuid(),
});
export const PLATFORM_QUEUE = 'reconcile-platform';
export * from './documents.js';

export * from './analysis.js';

export * from './claims.js';
