import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const orgId = (session?.user as { organizationId?: string } | undefined)?.organizationId;
  if (!orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const issue = await prisma.issue.findFirst({
    where: { id, organizationId: orgId },
    include: {
      issueSessions: {
        include: {
          session: {
            select: {
              id: true,
              posthogRecordingId: true,
              posthogSessionId: true,
              startedAt: true,
              durationSeconds: true,
            },
          },
        },
      },
    },
  });

  if (!issue) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const relatedSessions = issue.issueSessions.map((is) => ({
    id: is.id,
    sessionRecordingId: is.sessionRecordingId,
    timestampSeconds: is.timestampSeconds,
    snippet: is.snippet,
    posthogRecordingId: is.session.posthogRecordingId,
    posthogSessionId: is.session.posthogSessionId,
    startedAt: is.session.startedAt.toISOString(),
    durationSeconds: is.session.durationSeconds,
  }));

  return NextResponse.json({
    id: issue.id,
    title: issue.title,
    description: issue.description,
    severity: issue.severity,
    status: issue.status,
    category: issue.category,
    firstDetectedAt: issue.firstDetectedAt.toISOString(),
    suggestedFeature: issue.suggestedFeature,
    createdAt: issue.createdAt.toISOString(),
    relatedSessions,
    affectedCount: issue.issueSessions.length,
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const orgId = (session?.user as { organizationId?: string } | undefined)?.organizationId;
  if (!orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await prisma.issue.findFirst({
    where: { id, organizationId: orgId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const { status } = body as { status?: string };
  if (status === "resolved" || status === "open") {
    await prisma.issue.update({
      where: { id },
      data: { status },
    });
  }
  return NextResponse.json({ ok: true });
}
