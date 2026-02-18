-- Restore API key column for PostHog integration (use API key + project ID instead of OAuth only)
ALTER TABLE "Integration" ADD COLUMN IF NOT EXISTS "encrypted_api_key" TEXT;
