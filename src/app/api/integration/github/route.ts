import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getGitHubToken } from "@/lib/github";

function parseMetadata(metadata: unknown): { linkedRepo?: { owner: string; repo: string } } | null {
  if (metadata === null || typeof metadata !== "object") return null;
  const m = metadata as Record<string, unknown>;
  const lr = m.linkedRepo;
  if (lr === null || typeof lr !== "object") return null;
  const o = (lr as Record<string, unknown>).owner;
  const r = (lr as Record<string, unknown>).repo;
  if (typeof o !== "string" || typeof r !== "string" || !o.trim() || !r.trim())
    return null;
  return { linkedRepo: { owner: o.trim(), repo: r.trim() } };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const orgId = (session?.user as { organizationId?: string } | undefined)?.organizationId;
  if (!orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const integration = await prisma.integration.findUnique({
    where: { organizationId_type: { organizationId: orgId, type: "github" } },
  });

  const connected = Boolean(integration?.encryptedAccessToken);
  const linkedRepo = integration?.metadata ? parseMetadata(integration.metadata)?.linkedRepo ?? null : null;

  return NextResponse.json({
    connected,
    linkedRepo,
  });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  const orgId = (session?.user as { organizationId?: string } | undefined)?.organizationId;
  if (!orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { owner?: string; repo?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const owner = typeof body.owner === "string" ? body.owner.trim() : "";
  const repo = typeof body.repo === "string" ? body.repo.trim() : "";
  if (!owner || !repo) {
    return NextResponse.json(
      { error: "owner and repo are required" },
      { status: 400 }
    );
  }

  const token = await getGitHubToken(orgId);
  if (!token) {
    return NextResponse.json(
      { error: "GitHub not connected. Connect GitHub first." },
      { status: 400 }
    );
  }

  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) {
    return NextResponse.json(
      { error: "Cannot access that repo. Check owner/repo and token permissions." },
      { status: 400 }
    );
  }

  const existing = await prisma.integration.findUnique({
    where: { organizationId_type: { organizationId: orgId, type: "github" } },
  });
  if (!existing) {
    return NextResponse.json(
      { error: "GitHub not connected. Connect GitHub first." },
      { status: 400 }
    );
  }

  await prisma.integration.update({
    where: { organizationId_type: { organizationId: orgId, type: "github" } },
    data: { metadata: { linkedRepo: { owner, repo } } },
  });

  return NextResponse.json({ ok: true, linkedRepo: { owner, repo } });
}
