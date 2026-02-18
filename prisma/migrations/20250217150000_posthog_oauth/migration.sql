-- AlterTable: replace API key with OAuth token fields on Integration
-- Existing rows will have NULL encrypted_access_token (re-connect via OAuth to use PostHog).

ALTER TABLE "Integration" ADD COLUMN IF NOT EXISTS "encrypted_access_token" TEXT;
ALTER TABLE "Integration" ADD COLUMN IF NOT EXISTS "encrypted_refresh_token" TEXT;
ALTER TABLE "Integration" ADD COLUMN IF NOT EXISTS "access_token_expires_at" TIMESTAMP(3);

-- Drop old API key column (ignore if already dropped, e.g. fresh DB)
ALTER TABLE "Integration" DROP COLUMN IF EXISTS "encrypted_api_key";
