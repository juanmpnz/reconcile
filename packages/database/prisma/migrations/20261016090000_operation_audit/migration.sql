-- Optional bounded metadata for operation edits; no document contents.
ALTER TABLE "identity_audit_events" ADD COLUMN "details" JSONB;
