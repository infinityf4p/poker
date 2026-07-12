-- Idempotency responses from the pre-encryption schema are disposable and may
-- contain private projections. Remove them before enforcing the bound request hash.
DELETE FROM "command_results";
ALTER TABLE "command_results" ADD COLUMN "request_hash" text NOT NULL;
