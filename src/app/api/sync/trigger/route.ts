import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encrypt";
import { posthogListRecordings } from "@/lib/posthog";

export async function POST() {
  const session = await getServerSession(authOptions);
  const orgId = (session?.user as { organizationId?: string } | undefined)?.organizationId;
  if (!orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const integration = await prisma.integration.findUnique({
    where: { organizationId_type: { organizationId: orgId, type: "posthog" } },
  });
  if (!integration?.encryptedApiKey || !integration.projectId) {
    return NextResponse.json({ error: "PostHog not configured" }, { status: 400 });
  }
  const apiKey = decrypt(integration.encryptedApiKey);
  const host = integration.host ?? undefined;
  let total = 0;
  let offset = 0;
  const limit = 50;
  try {
    do {
      const { results } = await posthogListRecordings(
        { apiKey, projectId: integration.projectId, host },
        { limit, offset }
      );
      if (results.length === 0) break;
      for (const r of results as Array<{
        id?: string;
        session_id?: string;
        start_time?: string;
        duration?: number;
        click_count?: number;
        keypress_count?: number;
        console_error_count?: number;
      }>) {
        const recordingId = r.id ?? r.session_id;
        if (!recordingId) continue;
        const startedAt = r.start_time ? new Date(r.start_time) : new Date();
        await prisma.sessionRecording.upsert({
          where: {
            organizationId_posthogRecordingId: {
              organizationId: orgId,
              posthogRecordingId: recordingId,
            },
          },
          create: {
            organizationId: orgId,
            posthogSessionId: (r.session_id as string) ?? recordingId,
            posthogRecordingId: recordingId,
            startedAt,
            durationSeconds: typeof r.duration === "number" ? r.duration : 0,
            metadata: {
              click_count: r.click_count,
              keypress_count: r.keypress_count,
              console_error_count: r.console_error_count,
            } as object,
          },
          update: {
            startedAt,
            durationSeconds: typeof r.duration === "number" ? r.duration : 0,
            metadata: {
              click_count: r.click_count,
              keypress_count: r.keypress_count,
              console_error_count: r.console_error_count,
            } as object,
            syncedAt: new Date(),
          },
        });
        total++;
      }
      offset += results.length;
      if (results.length < limit) break;
    } while (true);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
  return NextResponse.json({
    ok: true,
    message: `Synced ${total} recording(s). Analysis will run on new recordings.`,
    count: total,
  });
}
