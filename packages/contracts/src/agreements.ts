import { z } from 'zod';

const text = z.string().trim().min(1).max(500);
const decimal = z.string().regex(/^\d{1,12}(?:\.\d{1,8})?$/);
const scaled = (v: string) => {
  if (!/^\d{1,12}(?:\.\d{1,8})?$/.test(v)) return 0n;
  const [whole = '0', fraction = ''] = v.split('.');
  return BigInt(whole) * 100000000n + BigInt(fraction.padEnd(8, '0'));
};
const positive = decimal.refine((v) => scaled(v) > 0n);
export const agreementDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(v + 'T00:00:00Z');
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v;
  });
export const agreementEvidenceSchema = z
  .object({
    documentId: z.uuid(),
    extractionRunId: z.uuid(),
    page: z.number().int().min(1).max(50),
    snippet: text,
  })
  .strict();
export const agreementBandSchema = z
  .object({
    fromKm: decimal,
    toKm: positive,
    basis: z.enum(['fixed-trip', 'per-km']),
    amount: positive,
    evidence: z.array(agreementEvidenceSchema).min(1).max(10),
  })
  .strict()
  .refine((b) => scaled(b.fromKm) < scaled(b.toKm), {
    message: 'Invalid distance range',
  });
export const agreementPricingSchema = z
  .discriminatedUnion('type', [
    z
      .object({
        type: z.literal('fixed-trip'),
        amount: positive,
        evidence: z.array(agreementEvidenceSchema).min(1).max(10),
      })
      .strict(),
    z
      .object({
        type: z.literal('per-km'),
        amount: positive,
        evidence: z.array(agreementEvidenceSchema).min(1).max(10),
      })
      .strict(),
    z
      .object({
        type: z.literal('distance-bands'),
        bands: z.array(agreementBandSchema).min(1).max(50),
      })
      .strict(),
  ])
  .superRefine((pricing, ctx) => {
    if (pricing.type !== 'distance-bands') return;
    for (let i = 1; i < pricing.bands.length; i++) {
      const previous = pricing.bands[i - 1],
        current = pricing.bands[i];
      if (previous && current && scaled(current.fromKm) < scaled(previous.toKm))
        ctx.addIssue({
          code: 'custom',
          message: 'Bands must be ordered and non-overlapping',
        });
    }
  });
export const agreementTermsSchema = z
  .object({
    agreementBasis: z.enum(['accepted', 'internal-estimate', 'unknown']),
    provider: text,
    currency: z.string().regex(/^[A-Z]{3}$/),
    validFrom: agreementDateSchema,
    validUntil: agreementDateSchema,
    route: text,
    service: z.enum(['ocean-handling', 'pickup']),
    pricing: agreementPricingSchema,
    evidence: z.array(agreementEvidenceSchema).min(1).max(20),
  })
  .strict()
  .refine((v) => v.validFrom <= v.validUntil, {
    message: 'Invalid validity period',
  });
export const agreementCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    scope: z.enum(['reusable', 'spot']),
    operationId: z.uuid().nullable(),
    sourceDocumentId: z.uuid(),
    terms: agreementTermsSchema,
    reason: text,
  })
  .strict()
  .refine((v) => (v.scope === 'spot') === (v.operationId !== null), {
    message:
      'Spot agreements require an operation; reusable agreements cannot have one',
  });
export const agreementVersionSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  name: z.string(),
  scope: z.enum(['reusable', 'spot']),
  operationId: z.uuid().nullable(),
  sourceDocumentId: z.uuid(),
  sourceExtractionRunId: z.uuid(),
  sourceSha256: z.string(),
  sourceMetadataVersion: z.number().int(),
  sourceCorrectionRevision: z.number().int(),
  terms: agreementTermsSchema,
  actorId: z.uuid(),
  reason: z.string(),
  createdAt: z.iso.datetime(),
});
export const agreementListSchema = z.object({
  items: z.array(agreementVersionSchema),
  total: z.number().int(),
  limit: z.number().int(),
  offset: z.number().int(),
});
export const agreementBindingInputSchema = z
  .object({
    invoiceDocumentId: z.uuid(),
    agreementVersionId: z.uuid(),
    serviceDate: agreementDateSchema,
    route: text,
    distanceKm: decimal.nullable(),
  })
  .strict();
export const operationAgreementsSchema = z
  .object({
    expectedFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    reason: text,
    bindings: z
      .array(agreementBindingInputSchema)
      .max(20)
      .refine(
        (v) => new Set(v.map((b) => b.invoiceDocumentId)).size === v.length,
      ),
  })
  .strict();
export const agreementBindingSchema = agreementBindingInputSchema.extend({
  agreement: agreementVersionSchema,
});
export type AgreementTerms = z.infer<typeof agreementTermsSchema>;
export type AgreementVersion = z.infer<typeof agreementVersionSchema>;
export type AgreementBinding = z.infer<typeof agreementBindingSchema>;
