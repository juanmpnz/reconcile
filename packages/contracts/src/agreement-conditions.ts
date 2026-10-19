import { z } from 'zod';
const nullableText = z.string().trim().min(1).max(500).nullable();
const money = z
  .string()
  .regex(/^-?\d{1,18}(?:\.\d{1,8})?$/)
  .nullable();
const service = z.enum(['ocean-handling', 'pickup', 'unknown']);
export const analysisEvidenceSchema = z
  .object({
    documentId: z.uuid(),
    extractionRunId: z.uuid(),
    page: z.number().int().min(1).max(50),
    snippet: z.string().min(1).max(500),
    revisionId: z.uuid().nullable(),
  })
  .strict();
export const applicabilityConditionSchema = z
  .object({
    state: z.enum(['restricted', 'unrestricted', 'unknown']),
    value: nullableText,
    evidence: z.array(analysisEvidenceSchema).max(20),
  })
  .strict();
export const agreementApplicabilitySchema = z
  .object({
    provider: applicabilityConditionSchema.optional(),
    contractingParty: applicabilityConditionSchema.optional(),
    origin: applicabilityConditionSchema.optional(),
    destination: applicabilityConditionSchema.optional(),
    service: applicabilityConditionSchema.optional(),
    transportMode: applicabilityConditionSchema.optional(),
    equipmentType: applicabilityConditionSchema.optional(),
    dateBasis: z.enum([
      'service-date',
      'shipment-date',
      'booking-date',
      'invoice-date',
      'unknown',
    ]),
    restrictions: z
      .array(
        applicabilityConditionSchema.extend({
          name: z.string().min(1).max(100),
        }),
      )
      .max(50),
  })
  .strict();
export const analysisLineSchema = z
  .object({
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .nullable()
      .optional(),
    equipmentType: nullableText.optional(),
    billingBasis: z
      .enum(['container', 'bl', 'shipment', 'other', 'unknown'])
      .optional(),
    includedIn: nullableText.optional(),
    id: z.string().min(1).max(100),
    description: z.string().min(1).max(500),
    service,
    route: nullableText,
    quantity: money,
    unit: nullableText,
    unitPrice: money,
    amount: money,
    evidence: z.array(analysisEvidenceSchema).max(20),
  })
  .strict();

export const agreementReferenceSchema = z
  .object({
    type: z.enum([
      'operation',
      'shipment',
      'booking',
      'bl',
      'agreement',
      'quotation',
    ]),
    value: z.string().min(1).max(500),
    evidence: z.array(analysisEvidenceSchema).max(20),
  })
  .strict();
