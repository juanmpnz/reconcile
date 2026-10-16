-- CreateTable
CREATE TABLE "agreement_versions" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "scope" VARCHAR(20) NOT NULL,
    "operationId" UUID,
    "sourceDocumentId" UUID NOT NULL,
    "sourceExtractionRunId" UUID NOT NULL,
    "sourceSha256" CHAR(64) NOT NULL,
    "sourceMetadataVersion" INTEGER NOT NULL,
    "sourceCorrectionRevision" INTEGER NOT NULL,
    "terms" JSONB NOT NULL,
    "actorId" UUID NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agreement_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operation_agreement_bindings" (
    "organizationId" UUID NOT NULL,
    "operationId" UUID NOT NULL,
    "invoiceDocumentId" UUID NOT NULL,
    "agreementVersionId" UUID NOT NULL,
    "serviceDate" VARCHAR(10) NOT NULL,
    "route" VARCHAR(500) NOT NULL,
    "distanceKm" DECIMAL(20,8),

    CONSTRAINT "operation_agreement_bindings_pkey" PRIMARY KEY ("organizationId","operationId","invoiceDocumentId")
);

-- CreateIndex
CREATE INDEX "agreement_versions_organizationId_createdAt_idx" ON "agreement_versions"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "agreement_versions_organizationId_id_key" ON "agreement_versions"("organizationId", "id");

-- AddForeignKey
ALTER TABLE "agreement_versions" ADD CONSTRAINT "agreement_versions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agreement_versions" ADD CONSTRAINT "agreement_versions_organizationId_sourceDocumentId_sourceE_fkey" FOREIGN KEY ("organizationId", "sourceDocumentId", "sourceExtractionRunId") REFERENCES "extraction_runs"("organizationId", "documentId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agreement_versions" ADD CONSTRAINT "agreement_versions_organizationId_sourceDocumentId_fkey" FOREIGN KEY ("organizationId", "sourceDocumentId") REFERENCES "documents"("organizationId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agreement_versions" ADD CONSTRAINT "agreement_versions_organizationId_operationId_fkey" FOREIGN KEY ("organizationId", "operationId") REFERENCES "operations"("organizationId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operation_agreement_bindings" ADD CONSTRAINT "operation_agreement_bindings_organizationId_operationId_fkey" FOREIGN KEY ("organizationId", "operationId") REFERENCES "operations"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operation_agreement_bindings" ADD CONSTRAINT "operation_agreement_bindings_organizationId_operationId_in_fkey" FOREIGN KEY ("organizationId", "operationId", "invoiceDocumentId") REFERENCES "operation_documents"("organizationId", "operationId", "documentId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operation_agreement_bindings" ADD CONSTRAINT "operation_agreement_bindings_organizationId_agreementVersi_fkey" FOREIGN KEY ("organizationId", "agreementVersionId") REFERENCES "agreement_versions"("organizationId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- Constraints preserve scope and non-negative operation context.
ALTER TABLE "agreement_versions" ADD CONSTRAINT "agreement_scope_check" CHECK ((scope='reusable' AND "operationId" IS NULL) OR (scope='spot' AND "operationId" IS NOT NULL));
ALTER TABLE "operation_agreement_bindings" ADD CONSTRAINT "agreement_distance_check" CHECK ("distanceKm" IS NULL OR "distanceKm" >= 0);
-- Reviewed versions are append-only; replacing terms creates a new UUID.
CREATE FUNCTION prevent_agreement_version_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'Agreement versions are immutable';
END;
$$;
CREATE TRIGGER agreement_version_immutable BEFORE UPDATE ON agreement_versions FOR EACH ROW EXECUTE FUNCTION prevent_agreement_version_update();
