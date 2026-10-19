-- Missing context remains missing; historical confirmations are not invented.
ALTER TABLE "operation_agreement_bindings"
  ALTER COLUMN "serviceDate" DROP NOT NULL,
  ALTER COLUMN "route" DROP NOT NULL,
  ADD COLUMN "selectedBy" UUID,
  ADD COLUMN "selectedAt" TIMESTAMPTZ(3),
  ADD COLUMN "selectionReason" VARCHAR(500);
