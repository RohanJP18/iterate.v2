import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const orgId = (session?.user as { organizationId?: string } | undefined)?.organizationId;
  if (!orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const filter = searchParams.get("filter") ?? "all"; // critical | all | resolved

  const where: { organizationId: string; status?: string; severity?: string } = {
    organizationId: orgId,
  };
  if (filter === "critical") {
    where.status = "open";
    where.severity = "critical";
  } else if (filter === "resolved") {
    where.status = "resolved";
  }
  // "all" = no extra filters

  const [issues, criticalCount, resolvedCount, allCount] = await Promise.all([
    prisma.issue.findMany({
      where,
      orderBy: { firstDetectedAt: "desc" },
      include: {
        _count: { select: { issueSessions: true } },
      },
    }),
    prisma.issue.count({
      where: { organizationId: orgId, status: "open", severity: "critical" },
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
    firstDetectedAt: i.firstDetectedAt.toISOString(),
    suggestedFeature: i.suggestedFeature,
    createdAt: i.createdAt.toISOString(),
    affectedCount: i._count.issueSessions,
  }));

  return NextResponse.json({
    issues: list,
    counts: { critical: criticalCount, resolved: resolvedCount, all: allCount },
  });
}
