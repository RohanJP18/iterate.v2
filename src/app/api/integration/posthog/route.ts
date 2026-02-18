import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/encrypt";
import { posthogListRecordings } from "@/lib/posthog";

export async function GET() {
  const session = await getServerSession(authOptions);
  const orgId = (session?.user as { organizationId?: string } | undefined)?.organizationId;
  if (!orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const integration = await prisma.integration.findUnique({
    where: { organizationId_type: { organizationId: orgId, type: "posthog" } },
  });
  if (!integration || !integration.encryptedApiKey || !integration.projectId) {
    return NextResponse.json({ connected: false, projectId: null, host: null });
  }
  return NextResponse.json({
    connected: true,
    projectId: integration.projectId,
    host: integration.host ?? undefined,
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const orgId = (session?.user as { organizationId?: string } | undefined)?.organizationId;
  if (!orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const { apiKey, projectId, host } = body as {
    apiKey?: string;
    projectId?: string;
    host?: string;
  };
  if (!apiKey?.trim() || !projectId?.trim()) {
    return NextResponse.json(
      { error: "API key and Project ID are required" },
      { status: 400 }
    );
  }
  try {
    const { results } = await posthogListRecordings(
      { apiKey: apiKey.trim(), projectId: projectId.trim(), host: host?.trim() },
      { limit: 1 }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "PostHog connection failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
  const encrypted = encrypt(apiKey.trim());
  await prisma.integration.upsert({
    where: { organizationId_type: { organizationId: orgId, type: "posthog" } },
    create: {
      organizationId: orgId,
      type: "posthog",
      encryptedApiKey: encrypted,
      projectId: projectId.trim(),
      host: host?.trim() || null,
    },
    update: {
      encryptedApiKey: encrypted,
      projectId: projectId.trim(),
      host: host?.trim() || null,
    },
  });
  return NextResponse.json({ ok: true });
}
