-- Add category to Issue for grouping by critical moment type (console_error, repeated_clicks, etc.)
ALTER TABLE "Issue" ADD COLUMN IF NOT EXISTS "category" TEXT;
