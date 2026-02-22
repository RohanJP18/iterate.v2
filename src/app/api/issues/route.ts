import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { groupIssuesByEmbedding } from "@/lib/embeddings";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const orgId = (session?.user as { organizationId?: string } | undefined)?.organizationId;
  if (!orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const filter = searchParams.get("filter") ?? "all"; // all | resolved

  const where: { organizationId: string; status?: string } = {
    organizationId: orgId,
  };
  if (filter === "resolved") {
    where.status = "resolved";
  }

  const [issues, resolvedCount, allCount] = await Promise.all([
    prisma.issue.findMany({
      where,
      orderBy: { firstDetectedAt: "desc" },
      include: {
        _count: { select: { issueSessions: true } },
      },
    }),
    prisma.issue.count({
      where: { organizationId: orgId, status: "resolved" },
    }),
    prisma.issue.count({ where: { organizationId: orgId } }),
  ]);

  const list = issues.map((i) => ({
    id: i.id,
    title: i.title,
    description: i.description,
    severity: i.severity,
    status: i.status,
    category: i.category,
    firstDetectedAt: i.firstDetectedAt.toISOString(),
    suggestedFeature: i.suggestedFeature,
    createdAt: i.createdAt.toISOString(),
    affectedCount: i._count.issueSessions,
    embeddingJson: i.embeddingJson,
  }));

  const categoryKey = (item: { category?: string | null }) => item.category ?? "other";
  const byCategory = new Map<string, typeof list>();
  for (const item of list) {
    const key = categoryKey(item);
    if (!byCategory.has(key)) byCategory.set(key, []);
    byCategory.get(key)!.push(item);
  }

  type ListItem = (typeof list)[number];
  const allRawGroups: ListItem[][] = [];
  Array.from(byCategory.values()).forEach((partition) => {
    const rawGroups = groupIssuesByEmbedding(partition as ListItem[], 0.85);
    allRawGroups.push(...rawGroups);
  });

  const groups = allRawGroups.map((group) => {
    const issuesInGroup = group.map(({ embeddingJson: _e, ...rest }) => rest);
    return {
      id: issuesInGroup[0].id,
      issues: issuesInGroup,
    };
  });

  return NextResponse.json({
    groups,
    counts: { all: allCount, resolved: resolvedCount },
  });
}
