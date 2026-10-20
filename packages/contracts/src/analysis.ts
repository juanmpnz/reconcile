import { z } from 'zod';
import { agreementBindingSchema } from './agreements.js';
import {
  agreementReferenceSchema,
  analysisEvidenceSchema,
  analysisLineSchema,
  agreementApplicabilitySchema,
} from './agreement-conditions.js';
export {
  agreementReferenceSchema,
  analysisEvidenceSchema,
  analysisLineSchema,
  agreementApplicabilitySchema,
  applicabilityConditionSchema,
} from './agreement-conditions.js';
export const ANALYSIS_QUEUE = 'reconcile-analysis';
export const ANALYSIS_PARSER_VERSION = 'logistics-text-v5';
const nullableText = z.string().trim().min(1).max(500).nullable();
const money = z
  .string()
  .regex(/^-?\d{1,18}(?:\.\d{1,8})?$/)
  .nullable();
const localDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(value + 'T00:00:00Z');
    return (
      Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 10) === value
    );
  })
  .nullable();
const service = z.enum(['ocean-handling', 'pickup', 'unknown']);
export const analysisDocumentSchema = z
  .object({
    billingPeriod: z
      .object({
        from: z.iso.date(),
        to: z.iso.date(),
        evidence: z.array(analysisEvidenceSchema).min(1).max(20),
      })
      .strict()
      .refine((period) => period.from <= period.to, 'Invalid billing period')
      .optional(),
    documentId: z.uuid(),
    extractionRunId: z.uuid(),
    revisionId: z.uuid().nullable(),
    kind: z.enum(['invoice', 'agreement', 'operational-record']),
    references: z.array(agreementReferenceSchema).max(100).optional(),
    agreementIdentity: nullableText.optional(),
    applicability: agreementApplicabilitySchema.optional(),
    origin: nullableText.optional(),
    destination: nullableText.optional(),
    transportMode: nullableText.optional(),
    equipmentType: nullableText.optional(),
    contractingParty: nullableText.optional(),
    shipmentDate: localDate.optional(),
    bookingDate: localDate.optional(),
    invoiceDate: localDate.optional(),
    exchangeRates: z
      .array(
        z
          .object({
            from: z.string().regex(/^[A-Z]{3}$/),
            to: z.string().regex(/^[A-Z]{3}$/),
            rate: z
              .string()
              .regex(/^\d{1,18}(?:\.\d{1,8})?$/)
              .refine((value) => !/^0(?:\.0+)?$/.test(value)),
            evidence: z.array(analysisEvidenceSchema).min(1).max(20),
          })
          .strict(),
      )
      .max(50)
      .optional(),
    equipmentQuantities: z
      .array(
        z
          .object({
            equipment: z.string().min(1).max(100),
            quantity: money,
            evidence: z.array(analysisEvidenceSchema).max(20),
          })
          .strict(),
      )
      .max(50)
      .optional(),
    blQuantity: money.optional(),
    shipmentQuantity: money.optional(),
    provider: nullableText,
    operationReference: nullableText,
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .nullable(),
    total: money,
    taxAmount: money,
    serviceDate: localDate,
    serviceReference: nullableText,
    route: nullableText,
    validFrom: localDate,
    validUntil: localDate,
    agreementBasis: z.enum(['accepted', 'internal-estimate', 'unknown']),
    excludedServices: z
      .array(
        z
          .object({
            service,
            route: nullableText,
            evidence: z.array(analysisEvidenceSchema).max(20),
          })
          .strict(),
      )
      .max(100),
    assignedProvider: nullableText,
    performedProvider: nullableText,
    serviceStatus: z.enum(['completed', 'unknown']),
    lines: z.array(analysisLineSchema).max(100),
    evidence: z.array(analysisEvidenceSchema).max(200),
    warnings: z.array(z.string().max(100)).max(100),
  })
  .strict();
export const analysisSnapshotSchema = z
  .object({
    organizationId: z.uuid(),
    operationReference: z.string().min(1).max(100),
    operationId: z.uuid().optional(),
    documents: z.array(analysisDocumentSchema).max(20),
    agreementBindings: z.array(agreementBindingSchema).max(20).optional(),
  })
  .strict();
export const analysisFindingSchema = z.object({
  documentId: z.uuid().nullable(),
  lineId: z.string().nullable(),
  service: z.string(),
  status: z.enum(['confirmed', 'probable', 'not-verifiable', 'matched']),
  code: z.string(),
  expected: money,
  invoiced: money,
  difference: money,
  currency: nullableText,
  explanation: z.string(),
  evidence: z.array(analysisEvidenceSchema),
});
export const analysisResultSchema = z.object({
  comparisonCandidates: z
    .array(
      z.object({
        invoiceDocumentId: z.uuid(),
        lineId: z.string().min(1).max(100),
        referenceDocumentId: z.uuid().nullable(),
        referenceLineId: z.string().min(1).max(100).nullable(),
        concept: nullableText,
        invoiceConcept: z.string().min(1).max(500),
        referenceConcept: nullableText,
        status: z.enum(['correct', 'difference', 'pending']),
        priceStatus: z.enum(['equal', 'different', 'unknown']),
        claimable: z.literal(false),
        aliasVersion: z.string().min(1).max(100),
        quantity: money,
        currency: nullableText,
        expectedCurrency: nullableText,
        actualCurrency: nullableText,
        expectedUnitPrice: money,
        actualUnitPrice: money,
        expectedAmount: z
          .string()
          .regex(/^-?\d{1,40}(?:\.\d{1,16})?$/)
          .nullable(),
        actualAmount: z
          .string()
          .regex(/^-?\d{1,40}(?:\.\d{1,16})?$/)
          .nullable(),
        difference: z
          .string()
          .regex(/^-?\d{1,40}(?:\.\d{1,16})?$/)
          .nullable(),
        conditions: z.array(
          z.object({
            name: z.string(),
            state: z.enum([
              'verified',
              'unknown',
              'contradictory',
              'unrestricted',
            ]),
            reason: z.string(),
            evidence: z.array(analysisEvidenceSchema),
          }),
        ),
        reasons: z.array(z.string()),
        calculation: z.string().nullable(),
        evidence: z.array(analysisEvidenceSchema),
      }),
    )
    .max(16000)
    .optional(),
  ruleVersion: z.string(),
  agreementDecisions: z
    .array(
      z.object({
        invoiceDocumentId: z.string(),
        lineId: z.string(),
        agreementDocumentId: z.string(),
        agreementVersionId: z.string().nullable(),
        state: z.enum(['applicable', 'pending', 'not-applicable']),
        reason: z.string(),
        conditions: z.array(
          z.object({
            name: z.string(),
            state: z.enum([
              'verified',
              'unknown',
              'contradictory',
              'unrestricted',
            ]),
            reason: z.string(),
            evidence: z.array(analysisEvidenceSchema),
          }),
        ),
        evidence: z.array(analysisEvidenceSchema),
      }),
    )
    .optional(),
  findings: z.array(analysisFindingSchema),
});
export const operationCreateSchema = z
  .object({
    reference: z.string().trim().min(1).max(100),
    name: z.string().trim().min(1).max(200),
  })
  .strict();
export const operationUpdateSchema = operationCreateSchema
  .extend({ expectedFingerprint: z.string().regex(/^[a-f0-9]{64}$/) })
  .strict();
export const operationDocumentsSchema = z
  .object({
    expectedFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    documentIds: z
      .array(z.uuid())
      .max(20)
      .refine((ids) => new Set(ids).size === ids.length),
  })
  .strict();
export const operationAttachDocumentSchema = z
  .object({
    documentId: z.uuid(),
    expectedFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export const factRevisionInputSchema = z
  .object({
    expectedFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    document: analysisDocumentSchema,
    reason: z.string().trim().min(1).max(500),
  })
  .strict();
export const analysisRequestSchema = z
  .object({ idempotencyKey: z.uuid() })
  .strict();
export const analysisJobSchema = z
  .object({
    outboxId: z.uuid(),
    organizationId: z.uuid(),
    operationId: z.uuid(),
    runId: z.uuid(),
    actorId: z.uuid(),
  })
  .strict();
export const operationSummarySchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  reference: z.string(),
  name: z.string(),
  revision: z.number().int(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export const analysisRunSchema = z.object({
  id: z.uuid(),
  operationId: z.uuid(),
  organizationId: z.uuid(),
  version: z.number().int(),
  status: z.enum(['queued', 'processing', 'completed', 'failed', 'blocked']),
  errorCode: z.string().nullable(),
  fingerprint: z.string(),
  parserVersion: z.string(),
  ruleVersion: z.string(),
  inputWarnings: z.array(z.string()),
  snapshot: analysisSnapshotSchema,
  sources: z.array(
    z.object({
      documentId: z.uuid(),
      sha256: z.string(),
      extractionRunId: z.uuid().nullable(),
      extractionVersion: z.number().int().nullable(),
      correctionRevision: z.number().int(),
      metadataVersion: z.number().int().optional(),
      factRevisionId: z.uuid().nullable(),
      sourceFingerprint: z.string(),
    }),
  ),
  result: analysisResultSchema.nullable(),
  stale: z.boolean(),
  createdAt: z.iso.datetime(),
  completedAt: z.iso.datetime().nullable(),
});
export const operationDetailSchema = operationSummarySchema.extend({
  documentIds: z.array(z.uuid()),
  agreementBindings: z.array(agreementBindingSchema).default([]),
  facts: z.array(analysisDocumentSchema),
  factRevisions: z.array(
    z.object({
      id: z.uuid(),
      documentId: z.uuid(),
      actorId: z.uuid(),
      reason: z.string(),
      ordinal: z.number().int(),
      createdAt: z.iso.datetime(),
    }),
  ),
  fingerprint: z.string(),
  warnings: z.array(z.string()),
  analyses: z.array(analysisRunSchema),
  capabilities: z.object({ canWrite: z.boolean() }),
});
export const operationListSchema = z.object({
  items: z.array(operationSummarySchema),
  total: z.number().int(),
  limit: z.number().int(),
  offset: z.number().int(),
});
export type AnalysisDocumentInput = z.infer<typeof analysisDocumentSchema>;
export type OperationDetail = z.infer<typeof operationDetailSchema>;
export type AnalysisRun = z.infer<typeof analysisRunSchema>;

export const analysisRunSummarySchema = analysisRunSchema.omit({
  snapshot: true,
  result: true,
  sources: true,
  inputWarnings: true,
});
export const analysisHistorySchema = z.object({
  items: z.array(analysisRunSummarySchema),
  total: z.number().int(),
  limit: z.number().int(),
  offset: z.number().int(),
});
