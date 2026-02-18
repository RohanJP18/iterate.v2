import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encrypt";
import { buildSessionStory, buildSessionStoryWithTimeline } from "@/lib/session-summary";
import { analyzeSessionStory } from "@/lib/analyze";
import { posthogSnapshotSources, posthogSnapshotBlob } from "@/lib/posthog";
import { parseJSONL, buildTimelineFromSnapshotEvents } from "@/lib/rrweb-timeline";
import { getEmbedding, findSimilarIssue } from "@/lib/embeddings";

export async function POST() {
  const session = await getServerSession(authOptions);
  const orgId = (session?.user as { organizationId?: string } | undefined)?.organizationId;
  if (!orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const run = await prisma.analysisRun.create({
    data: { organizationId: orgId },
  });

  const integration = await prisma.integration.findUnique({
    where: { organizationId_type: { organizationId: orgId, type: "posthog" } },
  });
  const posthogConfig =
    integration?.encryptedApiKey && integration.projectId
      ? {
          apiKey: decrypt(integration.encryptedApiKey),
          projectId: integration.projectId,
          host: integration.host ?? undefined,
        }
      : null;

  const recordings = await prisma.sessionRecording.findMany({
    where: { organizationId: orgId },
    orderBy: { startedAt: "desc" },
    take: 20,
  });

  console.log("[analyze/trigger] Starting run", { runId: run.id, orgId, recordingCount: recordings.length });

  let recordingsProcessed = 0;
  let issuesCreated = 0;

  try {
    try {
  for (const rec of recordings) {
    console.log("[analyze/trigger] Processing recording", { recordingId: rec.id, posthogRecordingId: rec.posthogRecordingId });
    let analysisPayload: string;
    if (posthogConfig) {
      try {
        const sources = await posthogSnapshotSources(posthogConfig, rec.posthogRecordingId);
        const blobSources = sources.filter((s) => s.source === "blob_v2" && s.blob_key).slice(0, 10);
        const allEvents: unknown[] = [];
        for (const src of blobSources) {
          const blobKey = (src as { blob_key?: string }).blob_key;
          if (!blobKey) continue;
          const body = await posthogSnapshotBlob(posthogConfig, rec.posthogRecordingId, blobKey);
          const events = parseJSONL(body);
          allEvents.push(...events);
        }
        if (allEvents.length > 0) {
          const timeline = buildTimelineFromSnapshotEvents(allEvents);
          analysisPayload = buildSessionStoryWithTimeline(
            {
              durationSeconds: rec.durationSeconds,
              metadata: rec.metadata as Record<string, unknown> | null,
              startedAt: rec.startedAt,
            },
            timeline
          );
        } else {
          analysisPayload = buildSessionStory({
            durationSeconds: rec.durationSeconds,
            metadata: rec.metadata as Record<string, unknown> | null,
            startedAt: rec.startedAt,
          });
        }
      } catch {
        analysisPayload = buildSessionStory({
          durationSeconds: rec.durationSeconds,
          metadata: rec.metadata as Record<string, unknown> | null,
          startedAt: rec.startedAt,
        });
      }
    } else {
      analysisPayload = buildSessionStory({
        durationSeconds: rec.durationSeconds,
        metadata: rec.metadata as Record<string, unknown> | null,
        startedAt: rec.startedAt,
      });
    }
    await prisma.sessionRecording.update({
      where: { id: rec.id },
      data: { analysisPayload },
    });
    recordingsProcessed++;

    const items = await analyzeSessionStory(analysisPayload, rec.id);
    let openIssuesWithEmbedding: { id: string; embeddingJson: string | null }[] = [];
    try {
      openIssuesWithEmbedding = await prisma.issue.findMany({
        where: { organizationId: orgId, status: "open", embeddingJson: { not: null } },
        select: { id: true, embeddingJson: true },
      });
    } catch {
      // if embeddingJson not yet migrated, skip embedding dedup
    }

    for (const item of items) {
      if (item.type !== "bug") continue;

      let existingId: string | null = null;
      try {
        const candidateEmbedding = await getEmbedding(item.title + " " + item.description);
        existingId = findSimilarIssue(candidateEmbedding, openIssuesWithEmbedding, 0.85);
      } catch {
        // fallback: title contains
        const byTitle = await prisma.issue.findFirst({
          where: {
            organizationId: orgId,
            status: "open",
            title: { contains: item.title.slice(0, 50), mode: "insensitive" },
          },
        });
        existingId = byTitle?.id ?? null;
      }

      if (existingId) {
        await prisma.issueSession.upsert({
          where: {
            issueId_sessionRecordingId: {
              issueId: existingId,
              sessionRecordingId: rec.id,
            },
          },
          create: {
            issueId: existingId,
            sessionRecordingId: rec.id,
            timestampSeconds: item.timestampSeconds,
            snippet: item.description.slice(0, 200),
          },
          update: {
            timestampSeconds: item.timestampSeconds,
            snippet: item.description.slice(0, 200),
          },
        });
      } else {
        let embeddingJson: string | null = null;
        try {
          const vec = await getEmbedding(item.title + " " + item.description);
          embeddingJson = JSON.stringify(vec);
        } catch {
          // leave null
        }
        const issue = await prisma.issue.create({
          data: {
            organizationId: orgId,
            title: item.title,
            description: item.description,
            severity: (item.severity ?? "medium").toLowerCase(),
            status: "open",
            firstDetectedAt: new Date(),
            suggestedFeature: item.suggestedFeatureReason ?? null,
            embeddingJson,
          },
        });
        if (embeddingJson) {
          openIssuesWithEmbedding.push({ id: issue.id, embeddingJson });
        }
        await prisma.issueSession.create({
          data: {
            issueId: issue.id,
            sessionRecordingId: rec.id,
            timestampSeconds: item.timestampSeconds,
            snippet: item.description.slice(0, 200),
          },
        });
        issuesCreated++;
      }
    }
  }
    } finally {
    await prisma.analysisRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        recordingsProcessed,
        issuesCreated,
      },
    });
  }

    console.log("[analyze/trigger] Run complete", { runId: run.id, recordingsProcessed, issuesCreated });
    return NextResponse.json({
      ok: true,
      message: `Processed ${recordingsProcessed} recording(s), created ${issuesCreated} new issue(s).`,
      recordingsProcessed,
      issuesCreated,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[analyze/trigger] Run failed", { runId: run.id, orgId, recordingsProcessed, issuesCreated, error: message, stack });
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
