import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encrypt";
import { buildSessionStory, buildSessionStoryWithTimeline } from "@/lib/session-summary";
import { analyzeSessionStory } from "@/lib/analyze";
import { posthogSnapshotSources, posthogSnapshotBlob } from "@/lib/posthog";
import { parseJSONL, buildTimelineFromSnapshotEvents, normalizeRRWebEvents } from "@/lib/rrweb-timeline";
import { detectCriticalMoments } from "@/lib/analysis/critical-moments";
import { buildEnrichedContext } from "@/lib/analysis/enrich-context";
import type { RRWebEvent } from "@/lib/analysis/types";
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
          try {
            const typedEvents = normalizeRRWebEvents(allEvents) as RRWebEvent[];
            const baseTs = (typedEvents[0]?.timestamp as number) ?? 0;
            const normalizedEvents: RRWebEvent[] = typedEvents.map((ev) => {
              const t = (ev.timestamp ?? baseTs) as number;
              return { ...ev, timestamp: t - baseTs };
            });
            const firstTs = 0;
            if (typedEvents.length > 0 && baseTs === 0) {
              const raw = allEvents[0] as Record<string, unknown> | null;
              console.log("[analyze/trigger] Raw event keys (first event had no timestamp; normalizer may need more mappings)", {
                recordingId: rec.id,
                rawKeys: raw && typeof raw === "object" ? Object.keys(raw) : [],
              });
            }
            console.log("[analyze/trigger] Pipeline input", {
              recordingId: rec.id,
              durationSeconds: rec.durationSeconds,
              baseTs,
              firstEventTs: typedEvents[0]?.timestamp,
              firstEventType: typedEvents[0]?.type,
              sampleTimestamps: typedEvents.slice(0, 5).map((e) => e.timestamp),
            });
            const criticalMoments = detectCriticalMoments(
              normalizedEvents,
              firstTs,
              rec.durationSeconds
            );
            const meta = (rec.metadata ?? {}) as Record<string, unknown>;
            const { enriched, sessionSummary } = buildEnrichedContext(
              normalizedEvents,
              criticalMoments,
              firstTs,
              { windowSeconds: 15, maxEventsPerWindow: 80 },
              {
                durationSeconds: rec.durationSeconds,
                click_count: meta.click_count as number | undefined,
                keypress_count: meta.keypress_count as number | undefined,
                console_error_count: meta.console_error_count as number | undefined,
                console_warn_count: meta.console_warn_count as number | undefined,
              }
            );
            const contextBlocks = enriched.map(
              (e) =>
                `Context around ${(e.momentTimestampMs / 1000).toFixed(1)}s:\n${e.contextText}`
            );
            analysisPayload = [sessionSummary, ...contextBlocks].join("\n\n");
            console.log("[analyze/trigger] New pipeline used", {
              recordingId: rec.id,
              eventCount: allEvents.length,
              momentCount: criticalMoments.length,
              firstContextEventCount: enriched[0] ? (enriched[0].contextText.startsWith("(no events") ? 0 : enriched[0].contextText.split("\n").length) : undefined,
              payloadPreview: analysisPayload.slice(0, 200) + (analysisPayload.length > 200 ? "..." : ""),
            });
          } catch (err) {
            console.log("[analyze/trigger] Fallback (enrich failed) for recording", rec.id, err);
            const timeline = buildTimelineFromSnapshotEvents(allEvents);
            analysisPayload = buildSessionStoryWithTimeline(
              {
                durationSeconds: rec.durationSeconds,
                metadata: rec.metadata as Record<string, unknown> | null,
                startedAt: rec.startedAt,
              },
              timeline
            );
          }
        } else {
          console.log("[analyze/trigger] No snapshot events for recording", rec.id, "- using metadata only");
          analysisPayload = buildSessionStory({
            durationSeconds: rec.durationSeconds,
            metadata: rec.metadata as Record<string, unknown> | null,
            startedAt: rec.startedAt,
          });
        }
      } catch (err) {
        console.log("[analyze/trigger] Fallback (blob fetch failed) for recording", rec.id, err);
        analysisPayload = buildSessionStory({
          durationSeconds: rec.durationSeconds,
          metadata: rec.metadata as Record<string, unknown> | null,
          startedAt: rec.startedAt,
        });
      }
    } else {
      console.log("[analyze/trigger] No PostHog config - using metadata only for recording", rec.id);
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
        const snippet = item.description.slice(0, 200);
        console.log("[analyze/trigger] IssueSession upsert", {
          recordingId: rec.id,
          issueId: existingId,
          timestampSeconds: item.timestampSeconds,
          snippetPreview: snippet.slice(0, 80) + (snippet.length > 80 ? "..." : ""),
        });
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
            snippet,
          },
          update: {
            timestampSeconds: item.timestampSeconds,
            snippet,
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
        const snippet = item.description.slice(0, 200);
        console.log("[analyze/trigger] IssueSession create", {
          recordingId: rec.id,
          issueId: issue.id,
          title: item.title.slice(0, 50),
          timestampSeconds: item.timestampSeconds,
          snippetPreview: snippet.slice(0, 80) + (snippet.length > 80 ? "..." : ""),
        });
        await prisma.issueSession.create({
          data: {
            issueId: issue.id,
            sessionRecordingId: rec.id,
            timestampSeconds: item.timestampSeconds,
            snippet,
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
