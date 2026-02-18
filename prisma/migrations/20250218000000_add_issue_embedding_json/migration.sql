-- Ensure Issue.embedding_json exists (e.g. if DB was created manually or from an older schema)
ALTER TABLE "Issue" ADD COLUMN IF NOT EXISTS "embedding_json" TEXT;
