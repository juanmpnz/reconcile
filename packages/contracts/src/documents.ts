import { z } from 'zod';
export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;
export const DOCUMENT_QUEUE = 'reconcile-documents';
export const documentKindSchema = z.enum([
  'invoice',
  'tariff',
  'quotation',
  'operational',
  'other',
]);
export const documentStatusSchema = z.enum([
  'queued',
  'processing',
  'needs_review',
  'ready',
  'failed',
  'blocked',
]);
export const extractionFieldNameSchema = z.enum([
  'provider',
  'documentNumber',
  'operationReference',
  'date',
  'currency',
  'total',
]);
export const evidenceSchema = z.object({
  page: z.number().int().min(1).max(50),
  snippet: z.string().max(500),
});
export const extractedFieldSchema = z.object({
  name: extractionFieldNameSchema,
  value: z.string().max(500).nullable(),
  evidence: evidenceSchema.nullable(),
  status: z.enum(['extracted', 'missing', 'ambiguous']),
});
export const extractionResultSchema = z.object({
  engine: z.literal('pdfjs-text-v1'),
  pages: z
    .array(
      z.object({
        page: z.number().int().min(1).max(50),
        text: z.string().max(200000),
      }),
    )
    .max(50),
  fields: z.array(extractedFieldSchema).max(6),
  warnings: z.array(z.string().max(100)).max(20),
});
export const documentSummarySchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  filename: z.string(),
  kind: documentKindSchema,
  sizeBytes: z.number().int(),
  status: documentStatusSchema,
  errorCode: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export const correctionInputSchema = z
  .object({
    extractionRunId: z.uuid(),
    field: extractionFieldNameSchema,
    value: z.string().trim().min(1).max(500).nullable(),
    reason: z.string().trim().min(1).max(500),
  })
  .strict();
export const correctionSchema = correctionInputSchema.extend({
  id: z.uuid(),
  revision: z.number().int(),
  actorId: z.uuid(),
  createdAt: z.iso.datetime(),
});
export const extractionRunSchema = z.object({
  id: z.uuid(),
  version: z.number().int(),
  status: documentStatusSchema,
  errorCode: z.string().nullable(),
  result: extractionResultSchema.nullable(),
  createdAt: z.iso.datetime(),
  completedAt: z.iso.datetime().nullable(),
});
export const documentDetailSchema = documentSummarySchema.extend({
  sha256: z.string(),
  latestRun: extractionRunSchema.nullable(),
  corrections: z.array(correctionSchema),
  capabilities: z.object({ canWrite: z.boolean() }),
});
export const documentListSchema = z.object({
  items: z.array(documentSummarySchema),
  total: z.number().int(),
  limit: z.number().int(),
  offset: z.number().int(),
});
export const documentJobSchema = z
  .object({
    outboxId: z.uuid(),
    organizationId: z.uuid(),
    documentId: z.uuid(),
    runId: z.uuid(),
    actorId: z.uuid(),
  })
  .strict();
export type DocumentKind = z.infer<typeof documentKindSchema>;
export type DocumentStatus = z.infer<typeof documentStatusSchema>;
export type ExtractionResult = z.infer<typeof extractionResultSchema>;
export type ExtractionFieldName = z.infer<typeof extractionFieldNameSchema>;
export type DocumentSummary = z.infer<typeof documentSummarySchema>;
export type DocumentDetail = z.infer<typeof documentDetailSchema>;
export type CorrectionInput = z.infer<typeof correctionInputSchema>;
