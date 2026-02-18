import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { posthogListRecordings } from "@/lib/posthog";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!(session?.user as { organizationId?: string } | undefined)?.organizationId) {
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
    await posthogListRecordings(
      { apiKey: apiKey.trim(), projectId: projectId.trim(), host: host?.trim() },
      { limit: 1 }
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Connection failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
