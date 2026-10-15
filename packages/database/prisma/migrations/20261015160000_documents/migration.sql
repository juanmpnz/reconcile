-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "filename" VARCHAR(200) NOT NULL,
    "kind" VARCHAR(20) NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "storageKey" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'queued',
    "errorCode" VARCHAR(64),
    "currentRunId" UUID,
    "runCount" INTEGER NOT NULL DEFAULT 0,
    "correctionCount" INTEGER NOT NULL DEFAULT 0,
    "uploadedBy" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extraction_runs" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "status" VARCHAR(20) NOT NULL DEFAULT 'queued',
    "errorCode" VARCHAR(64),
    "result" JSONB,
    "leaseUntil" TIMESTAMPTZ(3),
    "leaseToken" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ(3),

    CONSTRAINT "extraction_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_corrections" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "extractionRunId" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "field" VARCHAR(32) NOT NULL,
    "value" VARCHAR(500),
    "reason" VARCHAR(500) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_corrections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_outbox" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "runId" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastEnqueuedAt" TIMESTAMPTZ(3),
    "completedAt" TIMESTAMPTZ(3),

    CONSTRAINT "document_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "documents_storageKey_key" ON "documents"("storageKey");

-- CreateIndex
CREATE INDEX "documents_organizationId_createdAt_idx" ON "documents"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "documents_organizationId_id_key" ON "documents"("organizationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "documents_organizationId_sha256_key" ON "documents"("organizationId", "sha256");

-- CreateIndex
CREATE UNIQUE INDEX "extraction_runs_organizationId_documentId_id_key" ON "extraction_runs"("organizationId", "documentId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "extraction_runs_documentId_version_key" ON "extraction_runs"("documentId", "version");

-- CreateIndex
CREATE INDEX "document_corrections_organizationId_documentId_createdAt_idx" ON "document_corrections"("organizationId", "documentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "document_corrections_documentId_revision_key" ON "document_corrections"("documentId", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "document_outbox_runId_key" ON "document_outbox"("runId");

-- CreateIndex
CREATE INDEX "document_outbox_completedAt_lastEnqueuedAt_idx" ON "document_outbox"("completedAt", "lastEnqueuedAt");

-- CreateIndex
CREATE UNIQUE INDEX "document_outbox_organizationId_documentId_runId_key" ON "document_outbox"("organizationId", "documentId", "runId");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_organizationId_id_currentRunId_fkey" FOREIGN KEY ("organizationId", "id", "currentRunId") REFERENCES "extraction_runs"("organizationId", "documentId", "id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "extraction_runs" ADD CONSTRAINT "extraction_runs_organizationId_documentId_fkey" FOREIGN KEY ("organizationId", "documentId") REFERENCES "documents"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_corrections" ADD CONSTRAINT "document_corrections_organizationId_documentId_extractionR_fkey" FOREIGN KEY ("organizationId", "documentId", "extractionRunId") REFERENCES "extraction_runs"("organizationId", "documentId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_outbox" ADD CONSTRAINT "document_outbox_organizationId_documentId_runId_fkey" FOREIGN KEY ("organizationId", "documentId", "runId") REFERENCES "extraction_runs"("organizationId", "documentId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

