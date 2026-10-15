-- CreateTable
CREATE TABLE "operations" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "reference" VARCHAR(100) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "runCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operation_documents" (
    "organizationId" UUID NOT NULL,
    "operationId" UUID NOT NULL,
    "documentId" UUID NOT NULL,

    CONSTRAINT "operation_documents_pkey" PRIMARY KEY ("organizationId","operationId","documentId")
);

-- CreateTable
CREATE TABLE "analysis_fact_revisions" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "operationId" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "sourceFingerprint" CHAR(64) NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "facts" JSONB NOT NULL,
    "actorId" UUID NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analysis_fact_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analysis_runs" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "operationId" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "idempotencyKey" UUID NOT NULL,
    "fingerprint" CHAR(64) NOT NULL,
    "parserVersion" VARCHAR(64) NOT NULL,
    "ruleVersion" VARCHAR(64) NOT NULL,
    "snapshot" JSONB NOT NULL,
    "sources" JSONB NOT NULL,
    "inputWarnings" JSONB NOT NULL,
    "result" JSONB,
    "status" VARCHAR(20) NOT NULL DEFAULT 'queued',
    "errorCode" VARCHAR(64),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "leaseUntil" TIMESTAMPTZ(3),
    "leaseToken" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ(3),

    CONSTRAINT "analysis_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analysis_outbox" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "operationId" UUID NOT NULL,
    "runId" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastEnqueuedAt" TIMESTAMPTZ(3),
    "completedAt" TIMESTAMPTZ(3),

    CONSTRAINT "analysis_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "operations_organizationId_createdAt_idx" ON "operations"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "operations_organizationId_id_key" ON "operations"("organizationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "operations_organizationId_reference_key" ON "operations"("organizationId", "reference");

-- CreateIndex
CREATE INDEX "analysis_fact_revisions_organizationId_operationId_document_idx" ON "analysis_fact_revisions"("organizationId", "operationId", "documentId", "ordinal");

-- CreateIndex
CREATE UNIQUE INDEX "analysis_fact_revisions_organizationId_operationId_ordinal_key" ON "analysis_fact_revisions"("organizationId", "operationId", "ordinal");

-- CreateIndex
CREATE UNIQUE INDEX "analysis_runs_organizationId_operationId_id_key" ON "analysis_runs"("organizationId", "operationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "analysis_runs_organizationId_operationId_idempotencyKey_key" ON "analysis_runs"("organizationId", "operationId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "analysis_runs_operationId_version_key" ON "analysis_runs"("operationId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "analysis_outbox_runId_key" ON "analysis_outbox"("runId");

-- CreateIndex
CREATE INDEX "analysis_outbox_completedAt_lastEnqueuedAt_idx" ON "analysis_outbox"("completedAt", "lastEnqueuedAt");

-- CreateIndex
CREATE UNIQUE INDEX "analysis_outbox_organizationId_operationId_runId_key" ON "analysis_outbox"("organizationId", "operationId", "runId");

-- AddForeignKey
ALTER TABLE "operations" ADD CONSTRAINT "operations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operation_documents" ADD CONSTRAINT "operation_documents_organizationId_operationId_fkey" FOREIGN KEY ("organizationId", "operationId") REFERENCES "operations"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operation_documents" ADD CONSTRAINT "operation_documents_organizationId_documentId_fkey" FOREIGN KEY ("organizationId", "documentId") REFERENCES "documents"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_fact_revisions" ADD CONSTRAINT "analysis_fact_revisions_organizationId_operationId_fkey" FOREIGN KEY ("organizationId", "operationId") REFERENCES "operations"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_fact_revisions" ADD CONSTRAINT "analysis_fact_revisions_organizationId_documentId_fkey" FOREIGN KEY ("organizationId", "documentId") REFERENCES "documents"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_runs" ADD CONSTRAINT "analysis_runs_organizationId_operationId_fkey" FOREIGN KEY ("organizationId", "operationId") REFERENCES "operations"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_outbox" ADD CONSTRAINT "analysis_outbox_organizationId_operationId_runId_fkey" FOREIGN KEY ("organizationId", "operationId", "runId") REFERENCES "analysis_runs"("organizationId", "operationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

