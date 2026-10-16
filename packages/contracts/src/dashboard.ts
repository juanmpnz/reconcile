import { z } from 'zod';
const count = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
export const dashboardSchema = z.object({
  organizationId: z.uuid(),
  generatedAt: z.iso.datetime(),
  scope: z.literal('all_organization_records'),
  operations: z.object({
    total: count,
    withoutCompletedAnalysis: count,
    byLatestAnalysis: z.object({
      not_analyzed: count,
      queued: count,
      processing: count,
      completed: count,
      failed: count,
      blocked: count,
    }),
  }),
  documents: z.object({
    total: count,
    byStatus: z.object({
      queued: count,
      processing: count,
      needs_review: count,
      ready: count,
      failed: count,
      blocked: count,
    }),
  }),
  claims: z.object({
    total: count,
    open: count,
    byStatus: z.object({
      draft: count,
      exported: count,
      sent: count,
      in_review: count,
      follow_up: count,
      resolved: count,
      rejected: count,
    }),
  }),
  findings: z.object({
    scope: z.literal('latest_completed_per_operation'),
    includesHistorical: z.literal(true),
    humanConfirmations: count,
    confirmed: count,
    probable: count,
    notVerifiable: count,
    matched: count,
  }),
  pending: z.object({
    documents: z
      .array(
        z.object({
          id: z.uuid(),
          filename: z.string().max(200),
          status: z.enum(['needs_review', 'failed', 'blocked']),
        }),
      )
      .max(5),
    operations: z
      .array(
        z.object({
          id: z.uuid(),
          reference: z.string().max(100),
          name: z.string().max(200),
          status: z.enum([
            'not_analyzed',
            'queued',
            'processing',
            'failed',
            'blocked',
          ]),
        }),
      )
      .max(5),
    claims: z
      .array(
        z.object({
          id: z.uuid(),
          operationId: z.uuid(),
          provider: z.string().max(500),
          status: z.enum([
            'draft',
            'exported',
            'sent',
            'in_review',
            'follow_up',
          ]),
          dueDate: z.string().nullable(),
        }),
      )
      .max(5),
  }),
});
export type Dashboard = z.infer<typeof dashboardSchema>;
