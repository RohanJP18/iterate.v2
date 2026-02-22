import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encrypt";
import { posthogSnapshotSources, posthogSnapshotBlob } from "@/lib/posthog";
import { parseJSONL, normalizeRRWebEvents, decompressGzipDataIfNeeded } from "@/lib/rrweb-timeline";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sessionRecordingId: string }> }
) {
  const session = await getServerSession(authOptions);
  const orgId = (session?.user as { organizationId?: string } | undefined)?.organizationId;
  if (!orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionRecordingId } = await params;
  const recording = await prisma.sessionRecording.findFirst({
    where: { id: sessionRecordingId, organizationId: orgId },
  });
  if (!recording) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const integration = await prisma.integration.findUnique({
    where: { organizationId_type: { organizationId: orgId, type: "posthog" } },
  });
  if (!integration?.encryptedApiKey || !integration.projectId) {
    return NextResponse.json({ error: "PostHog not configured" }, { status: 400 });
  }

  const config = {
    apiKey: decrypt(integration.encryptedApiKey),
    projectId: integration.projectId,
    host: integration.host ?? undefined,
  };

  try {
    const sources = await posthogSnapshotSources(config, recording.posthogRecordingId);
    const blobSources = sources.filter((s) => s.source === "blob_v2" && (s as { blob_key?: string }).blob_key).slice(0, 20);
    const allEvents: unknown[] = [];
    for (const src of blobSources) {
      const blobKey = (src as { blob_key?: string }).blob_key;
      if (!blobKey) continue;
      const body = await posthogSnapshotBlob(config, recording.posthogRecordingId, blobKey);
      const events = parseJSONL(body);
      allEvents.push(...events);
    }
    if (allEvents.length > 0) {
      const firstRaw = allEvents[0];
      const firstEvent =
        Array.isArray(firstRaw) && firstRaw.length >= 2
          ? (firstRaw as unknown[])[1]
          : firstRaw;
      const firstEventObj =
        firstEvent !== null && typeof firstEvent === "object" ? (firstEvent as Record<string, unknown>) : {};
      console.log("[snapshots] First raw event keys", {
        sessionRecordingId,
        isArray: Array.isArray(firstRaw),
        firstEventKeys: Object.keys(firstEventObj),
      });
      const fullSnapshotRaw = allEvents.find((ev) => {
        const o = Array.isArray(ev) && ev.length >= 2 ? (ev as unknown[])[1] : ev;
        if (o === null || typeof o !== "object") return false;
        const t = (o as Record<string, unknown>).type ?? (o as Record<string, unknown>).t;
        return t === 2 || t === "2";
      });
      if (fullSnapshotRaw !== undefined) {
        const fsEvent =
          Array.isArray(fullSnapshotRaw) && fullSnapshotRaw.length >= 2
            ? (fullSnapshotRaw as unknown[])[1]
            : fullSnapshotRaw;
        const fsData =
          fsEvent !== null && typeof fsEvent === "object"
            ? (fsEvent as Record<string, unknown>).data ??
              (fsEvent as Record<string, unknown>).d ??
              (fsEvent as Record<string, unknown>).payload ??
              (fsEvent as Record<string, unknown>).p
            : undefined;
        const fsDataObj =
          fsData !== null && typeof fsData === "object" && !Array.isArray(fsData)
            ? (fsData as Record<string, unknown>)
            : {};
        const fsDataLog: Record<string, unknown> = {
          sessionRecordingId,
          dataKeys: Object.keys(fsDataObj),
          typeofData: typeof fsData,
          isArray: Array.isArray(fsData),
        };
        if (Array.isArray(fsData)) {
          fsDataLog.arrayLength = fsData.length;
          if (fsData.length > 0 && fsData[0] !== null && typeof fsData[0] === "object") {
            fsDataLog.firstElementKeys = Object.keys(fsData[0] as Record<string, unknown>);
          }
        }
        if (typeof fsData === "string") {
          fsDataLog.stringLength = fsData.length;
          fsDataLog.stringPrefix = fsData.slice(0, 80);
          try {
            const parsed = JSON.parse(fsData) as unknown;
            fsDataLog.parsedType = typeof parsed;
            fsDataLog.parsedIsArray = Array.isArray(parsed);
            if (parsed !== null && typeof parsed === "object") {
              if (Array.isArray(parsed)) {
                fsDataLog.parsedLength = parsed.length;
                if (parsed[0] != null && typeof parsed[0] === "object") {
                  fsDataLog.parsedFirstKeys = Object.keys(parsed[0] as Record<string, unknown>);
                }
              } else {
                fsDataLog.parsedKeys = Object.keys(parsed as Record<string, unknown>);
              }
            }
          } catch {
            fsDataLog.parseError = true;
            try {
              const decoded = Buffer.from(fsData, "base64").toString("utf-8");
              const parsed = JSON.parse(decoded) as unknown;
              fsDataLog.base64DecodeWorked = true;
              fsDataLog.parsedType = typeof parsed;
              fsDataLog.parsedIsArray = Array.isArray(parsed);
              if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
                fsDataLog.parsedKeys = Object.keys(parsed as Record<string, unknown>);
              }
            } catch {
              fsDataLog.base64DecodeWorked = false;
            }
          }
        }
        console.log("[snapshots] First full-snapshot event data", fsDataLog);
      }
    }
    decompressGzipDataIfNeeded(allEvents);
    const normalized = normalizeRRWebEvents(allEvents);
    return NextResponse.json({ events: normalized });
  } catch (e) {
    console.error("Snapshots fetch error:", e);
    return NextResponse.json(
      { error: "Failed to load recording snapshots" },
      { status: 503 }
    );
  }
}
