import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEmbedding } from "@/lib/embeddings";

export async function POST() {
  const session = await getServerSession(authOptions);
  const orgId = (session?.user as { organizationId?: string } | undefined)?.organizationId;
  if (!orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const issues = await prisma.issue.findMany({
    where: { organizationId: orgId, embeddingJson: null },
    select: { id: true, title: true, description: true },
  });

  let updated = 0;
  for (const issue of issues) {
    try {
      const vec = await getEmbedding(issue.title + " " + issue.description);
      await prisma.issue.update({
        where: { id: issue.id },
        data: { embeddingJson: JSON.stringify(vec) },
      });
      updated++;
    } catch {
      // skip failed
    }
  }

  return NextResponse.json({
    ok: true,
    message: `Backfilled embeddings for ${updated} of ${issues.length} issues.`,
    updated,
    total: issues.length,
  });
}
