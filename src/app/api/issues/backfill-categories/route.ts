import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encrypt";
import { posthogSnapshotSources, posthogSnapshotBlob } from "@/lib/posthog";
import {
  parseJSONL,
  normalizeRRWebEvents,
  decompressGzipDataIfNeeded,
} from "@/lib/rrweb-timeline";
import { detectCriticalMoments, getCategoryForTimestamp } from "@/lib/analysis/critical-moments";
import type { RRWebEvent } from "@/lib/analysis/types";

export async function POST() {
  const session = await getServerSession(authOptions);
  const orgId = (session?.user as { organizationId?: string } | undefined)?.organizationId;
  if (!orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const issues = await prisma.issue.findMany({
    where: { organizationId: orgId, category: null },
    include: {
      issueSessions: {
        include: {
          session: true,
        },
        orderBy: { timestampSeconds: "asc" },
        take: 1,
      },
    },
  });

  const integration = await prisma.integration.findUnique({
    where: { organizationId_type: { organizationId: orgId, type: "posthog" } },
  });
  const config =
    integration?.encryptedApiKey && integration.projectId
      ? {
          apiKey: decrypt(integration.encryptedApiKey),
          projectId: integration.projectId,
          host: integration.host ?? undefined,
        }
      : null;

  let updated = 0;

  for (const issue of issues) {
    const firstSession = issue.issueSessions[0];
    if (!firstSession?.session) {
      await prisma.issue.update({
        where: { id: issue.id },
        data: { category: "other" },
      });
      updated++;
      continue;
    }

    const recording = firstSession.session;
    let category: string = "other";

    if (config) {
      try {
        const sources = await posthogSnapshotSources(config, recording.posthogRecordingId);
        const blobSources = sources
          .filter((s) => s.source === "blob_v2" && (s as { blob_key?: string }).blob_key)
          .slice(0, 10);
        const allEvents: unknown[] = [];
        for (const src of blobSources) {
          const blobKey = (src as { blob_key?: string }).blob_key;
          if (!blobKey) continue;
          const body = await posthogSnapshotBlob(config, recording.posthogRecordingId, blobKey);
          allEvents.push(...parseJSONL(body));
        }
        if (allEvents.length > 0) {
          decompressGzipDataIfNeeded(allEvents);
          const typedEvents = normalizeRRWebEvents(allEvents) as RRWebEvent[];
          const baseTs = (typedEvents[0]?.timestamp as number) ?? 0;
          const normalized: RRWebEvent[] = typedEvents.map((ev) => {
            const t = (ev.timestamp ?? baseTs) as number;
            return { ...ev, timestamp: t - baseTs };
          });
          const moments = detectCriticalMoments(
            normalized,
            0,
            recording.durationSeconds
          );
          category = getCategoryForTimestamp(firstSession.timestampSeconds, moments);
        }
      } catch {
        // leave category as "other"
      }
    }

    await prisma.issue.update({
      where: { id: issue.id },
      data: { category },
    });
    updated++;
  }

  return NextResponse.json({
    ok: true,
    updated,
    total: issues.length,
  });
}
