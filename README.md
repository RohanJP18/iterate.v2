# Iterate

AI-powered UX bug detection from PostHog session replays. Connect PostHog, sync recordings, run analysis to detect issues and get feature suggestions—with exact session + timestamp for each finding.

## Setup

1. **Environment**
   - Copy `.env.example` to `.env`
   - Set `DATABASE_URL` to your PostgreSQL connection string (e.g. Supabase or local Postgres)
   - Set `NEXTAUTH_SECRET` (e.g. `openssl rand -base64 32`)
   - Set `NEXTAUTH_URL` (e.g. `http://localhost:3000`)
   - Set `OPENAI_API_KEY` for the analysis pipeline

2. **Database**
   ```bash
   npx prisma migrate deploy   # preferred: applies all migrations
   # or
   npx prisma db push          # syncs schema without migration history
   ```
   **Supabase:** Migrations run against your project when `DATABASE_URL` points at it. If you ever need to run SQL by hand (e.g. you skipped a migration), open **Supabase Dashboard → SQL Editor** and run the relevant migration file from `prisma/migrations/`. For example, to ensure `Issue.embedding_json` exists:  
   `ALTER TABLE "Issue" ADD COLUMN IF NOT EXISTS "embedding_json" TEXT;`

3. **Run**
   ```bash
   npm install
   npm run dev
   ```

4. **First use**
   - Sign up at `/signup`, then sign in
   - Go to **Integration**, add your PostHog API key (personal key with `session_recording:read`) and Project ID
   - Click **Sync now** to fetch recordings, then **Run analysis** to detect issues
   - Open **Issues** to see findings, related sessions, and “View recording at &lt;time&gt;”

## Stack

- Next.js 14 (App Router), React, TypeScript, Tailwind
- PostgreSQL + Prisma
- NextAuth (credentials)
- OpenAI for session analysis
