-- CreateTable
CREATE TABLE "PRDDraft" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "seed_conversation_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PRDDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PRDMessage" (
    "id" TEXT NOT NULL,
    "prd_draft_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PRDMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PRDDraft_organization_id_idx" ON "PRDDraft"("organization_id");

-- CreateIndex
CREATE INDEX "PRDDraft_seed_conversation_id_idx" ON "PRDDraft"("seed_conversation_id");

-- CreateIndex
CREATE INDEX "PRDMessage_prd_draft_id_idx" ON "PRDMessage"("prd_draft_id");

-- AddForeignKey
ALTER TABLE "PRDDraft" ADD CONSTRAINT "PRDDraft_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PRDDraft" ADD CONSTRAINT "PRDDraft_seed_conversation_id_fkey" FOREIGN KEY ("seed_conversation_id") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PRDMessage" ADD CONSTRAINT "PRDMessage_prd_draft_id_fkey" FOREIGN KEY ("prd_draft_id") REFERENCES "PRDDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;
