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
  const period = searchParams.get("period") ?? "30d";
  const days = period === "7d" ? 7 : 30;

  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  const issues = await prisma.issue.findMany({
    where: { organizationId: orgId, firstDetectedAt: { gte: since } },
    select: { firstDetectedAt: true, severity: true, status: true },
  });

  const bucketMap = new Map<string, { total: number; critical: number; resolved: number }>();
  for (let d = 0; d < days; d++) {
    const dte = new Date(since);
    dte.setDate(dte.getDate() + d);
    const key = dte.toISOString().slice(0, 10);
    bucketMap.set(key, { total: 0, critical: 0, resolved: 0 });
  }

  for (const i of issues) {
    const key = i.firstDetectedAt.toISOString().slice(0, 10);
    const b = bucketMap.get(key);
    if (!b) continue;
    b.total++;
    if (i.severity === "critical") b.critical++;
    if (i.status === "resolved") b.resolved++;
  }

  const buckets = Array.from(bucketMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, counts]) => ({ date, ...counts }));

  return NextResponse.json({ buckets });
}
