-- AlterTable
ALTER TABLE "operations" ADD COLUMN     "reviewVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "finding_decisions" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "operationId" UUID NOT NULL,
    "runId" UUID NOT NULL,
    "findingIndex" INTEGER NOT NULL,
    "action" VARCHAR(16) NOT NULL,
    "reason" VARCHAR(1000) NOT NULL,
    "actorId" UUID NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finding_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "claims" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "operationId" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "runId" UUID NOT NULL,
    "findingIndex" INTEGER NOT NULL,
    "sourceVersion" INTEGER NOT NULL DEFAULT 1,
    "version" INTEGER NOT NULL DEFAULT 1,
    "kind" VARCHAR(20) NOT NULL,
    "provider" VARCHAR(500) NOT NULL,
    "amount" DECIMAL(38,12),
    "currency" VARCHAR(3),
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "dueDate" VARCHAR(10),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "claim_sources" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "operationId" UUID NOT NULL,
    "claimId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "data" JSONB NOT NULL,
    "actorId" UUID NOT NULL,
    "reason" VARCHAR(1000) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "claim_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "claim_drafts" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "operationId" UUID NOT NULL,
    "claimId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "sourceVersion" INTEGER NOT NULL,
    "recipientEmail" VARCHAR(254),
    "subject" VARCHAR(200) NOT NULL,
    "body" VARCHAR(10000) NOT NULL,
    "reason" VARCHAR(1000) NOT NULL,
    "actorId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "claim_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "claim_events" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "operationId" UUID NOT NULL,
    "claimId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "reason" VARCHAR(1000) NOT NULL,
    "actorId" UUID NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,
    "dueDate" VARCHAR(10),
    "outcome" VARCHAR(20),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "claim_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "claim_exports" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "operationId" UUID NOT NULL,
    "claimId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "sourceVersion" INTEGER NOT NULL,
    "draftId" UUID NOT NULL,
    "draftVersion" INTEGER NOT NULL,
    "format" VARCHAR(16) NOT NULL,
    "bytes" BYTEA NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "actorId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "claim_exports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "finding_decisions_organizationId_operationId_runId_findingI_idx" ON "finding_decisions"("organizationId", "operationId", "runId", "findingIndex", "ordinal");

-- CreateIndex
CREATE UNIQUE INDEX "finding_decisions_organizationId_operationId_ordinal_key" ON "finding_decisions"("organizationId", "operationId", "ordinal");

-- CreateIndex
CREATE UNIQUE INDEX "claims_organizationId_operationId_id_key" ON "claims"("organizationId", "operationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "claims_organizationId_operationId_documentId_key" ON "claims"("organizationId", "operationId", "documentId");

-- CreateIndex
CREATE UNIQUE INDEX "claim_sources_claimId_version_key" ON "claim_sources"("claimId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "claim_drafts_claimId_version_key" ON "claim_drafts"("claimId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "claim_events_claimId_version_key" ON "claim_events"("claimId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "claim_exports_claimId_version_key" ON "claim_exports"("claimId", "version");

-- AddForeignKey
ALTER TABLE "finding_decisions" ADD CONSTRAINT "finding_decisions_organizationId_operationId_fkey" FOREIGN KEY ("organizationId", "operationId") REFERENCES "operations"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finding_decisions" ADD CONSTRAINT "finding_decisions_organizationId_operationId_runId_fkey" FOREIGN KEY ("organizationId", "operationId", "runId") REFERENCES "analysis_runs"("organizationId", "operationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_organizationId_operationId_fkey" FOREIGN KEY ("organizationId", "operationId") REFERENCES "operations"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_organizationId_documentId_fkey" FOREIGN KEY ("organizationId", "documentId") REFERENCES "documents"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_organizationId_operationId_runId_fkey" FOREIGN KEY ("organizationId", "operationId", "runId") REFERENCES "analysis_runs"("organizationId", "operationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_sources" ADD CONSTRAINT "claim_sources_organizationId_operationId_claimId_fkey" FOREIGN KEY ("organizationId", "operationId", "claimId") REFERENCES "claims"("organizationId", "operationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_drafts" ADD CONSTRAINT "claim_drafts_organizationId_operationId_claimId_fkey" FOREIGN KEY ("organizationId", "operationId", "claimId") REFERENCES "claims"("organizationId", "operationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_events" ADD CONSTRAINT "claim_events_organizationId_operationId_claimId_fkey" FOREIGN KEY ("organizationId", "operationId", "claimId") REFERENCES "claims"("organizationId", "operationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_exports" ADD CONSTRAINT "claim_exports_organizationId_operationId_claimId_fkey" FOREIGN KEY ("organizationId", "operationId", "claimId") REFERENCES "claims"("organizationId", "operationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

