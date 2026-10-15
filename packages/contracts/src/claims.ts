import { z } from 'zod';
import { analysisFindingSchema, analysisSnapshotSchema } from './analysis.js';
const fingerprint = z.string().regex(/^[a-f0-9]{64}$/);
const version = z.number().int().min(0);
const note = z.string().trim().min(1).max(1000);
const calendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(value + 'T00:00:00Z');
    return (
      Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 10) === value
    );
  });
export const decisionActionSchema = z.enum(['confirm', 'accept', 'dismiss']);
export const findingDecisionInputSchema = z
  .object({
    findingIndex: z.number().int().min(0).max(1000),
    action: decisionActionSchema,
    reason: note,
    expectedVersion: version,
    expectedFingerprint: fingerprint,
  })
  .strict();
export const claimCreateInputSchema = z
  .object({
    runId: z.uuid(),
    findingIndex: z.number().int().min(0).max(1000),
    expectedVersion: version,
    expectedFingerprint: fingerprint,
  })
  .strict();
export const claimDraftInputSchema = z
  .object({
    expectedVersion: version,
    recipientEmail: z.email().max(254).nullable(),
    subject: z.string().trim().min(1).max(200),
    body: z.string().trim().min(1).max(10000),
    reason: note,
  })
  .strict();
export const claimStatusSchema = z.enum([
  'draft',
  'exported',
  'sent',
  'in_review',
  'follow_up',
  'resolved',
  'rejected',
]);
export const claimEventInputSchema = z
  .object({
    expectedVersion: version,
    status: z.enum(['sent', 'in_review', 'follow_up', 'resolved', 'rejected']),
    reason: note,
    occurredAt: z.iso.datetime(),
    dueDate: calendarDate.nullable(),
    recipientConfirmed: z.boolean().optional(),
    outcome: z
      .enum(['corrected', 'accepted', 'rejected', 'withdrawn'])
      .optional(),
  })
  .strict();
export const claimRebaseInputSchema = claimCreateInputSchema
  .extend({ expectedReviewVersion: version, reason: note })
  .strict();
export const claimExportInputSchema = z
  .object({ expectedVersion: version, format: z.enum(['text', 'dossier']) })
  .strict();
export const findingDecisionSchema = z.object({
  id: z.uuid(),
  runId: z.uuid(),
  findingIndex: z.number().int(),
  action: decisionActionSchema,
  reason: z.string(),
  actorId: z.uuid(),
  ordinal: z.number().int(),
  createdAt: z.iso.datetime(),
});
export const claimDraftVersionSchema = z.object({
  id: z.uuid(),
  version: z.number().int(),
  sourceVersion: z.number().int(),
  recipientEmail: z.string().nullable(),
  subject: z.string(),
  body: z.string(),
  reason: z.string(),
  actorId: z.uuid(),
  createdAt: z.iso.datetime(),
});
export const claimEventSchema = z.object({
  id: z.uuid(),
  version: z.number().int(),
  status: claimStatusSchema,
  reason: z.string(),
  actorId: z.uuid(),
  occurredAt: z.iso.datetime(),
  dueDate: calendarDate.nullable(),
  outcome: z.string().nullable(),
  createdAt: z.iso.datetime(),
});
export const claimSummarySchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  operationId: z.uuid(),
  documentId: z.uuid(),
  runId: z.uuid(),
  findingIndex: z.number().int(),
  version: z.number().int(),
  kind: z.enum(['correction', 'clarification']),
  provider: z.string(),
  amount: z
    .string()
    .regex(/^\d+(?:\.\d+)?$/)
    .nullable(),
  currency: z.string().nullable(),
  status: claimStatusSchema,
  stale: z.boolean(),
  dueDate: calendarDate.nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export const claimDetailSchema = claimSummarySchema.extend({
  finding: analysisFindingSchema,
  snapshot: analysisSnapshotSchema,
  sourceFingerprint: fingerprint,
  decision: findingDecisionSchema,
  exports: z.array(
    z.object({
      id: z.uuid(),
      version: z.number().int(),
      format: z.enum(['text', 'dossier']),
      sha256: z.string(),
      actorId: z.uuid(),
      createdAt: z.iso.datetime(),
    }),
  ),
  drafts: z.array(claimDraftVersionSchema),
  events: z.array(claimEventSchema),
  sources: z.array(
    z.object({
      version: z.number().int(),
      actorId: z.uuid(),
      reason: z.string(),
      createdAt: z.iso.datetime(),
      data: z.object({
        runId: z.uuid(),
        findingIndex: z.number().int(),
        fingerprint,
        finding: analysisFindingSchema,
        snapshot: analysisSnapshotSchema,
        decision: findingDecisionSchema,
        ruleVersion: z.string(),
        parserVersion: z.string(),
        runVersion: z.number().int(),
        inputWarnings: z.array(z.string()),
        sources: z.array(z.unknown()),
        documents: z.array(
          z.object({
            id: z.uuid(),
            filename: z.string(),
            sha256: z.string(),
            invoiceReference: z.string().nullable(),
          }),
        ),
      }),
    }),
  ),
  capabilities: z.object({ canWrite: z.boolean() }),
});
export const operationReviewSchema = z.object({
  organizationId: z.uuid(),
  operationId: z.uuid(),
  version: z.number().int(),
  fingerprint,
  decisions: z.array(findingDecisionSchema),
  claims: z.array(claimSummarySchema),
  capabilities: z.object({ canWrite: z.boolean() }),
});
export type ClaimDetail = z.infer<typeof claimDetailSchema>;
export type OperationReview = z.infer<typeof operationReviewSchema>;
