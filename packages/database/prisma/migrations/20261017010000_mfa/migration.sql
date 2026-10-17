ALTER TABLE "auth_users" ADD COLUMN "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "auth_sessions" ADD COLUMN "mfaVerifiedAt" TIMESTAMPTZ(3);
CREATE TABLE "auth_two_factors" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "secret" TEXT NOT NULL,
  "backupCodes" TEXT NOT NULL,
  "verified" BOOLEAN NOT NULL DEFAULT false,
  "failedVerificationCount" INTEGER NOT NULL DEFAULT 0,
  "lockedUntil" TIMESTAMPTZ(3),
  CONSTRAINT "auth_two_factors_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "auth_two_factors_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth_users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "auth_two_factors_userId_key" ON "auth_two_factors"("userId");
