import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encrypt";
import { posthogSnapshotSources, posthogSnapshotBlob } from "@/lib/posthog";
import { parseJSONL } from "@/lib/rrweb-timeline";

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
    return NextResponse.json({ events: allEvents });
  } catch (e) {
    console.error("Snapshots fetch error:", e);
    return NextResponse.json(
      { error: "Failed to load recording snapshots" },
      { status: 503 }
    );
  }
}
