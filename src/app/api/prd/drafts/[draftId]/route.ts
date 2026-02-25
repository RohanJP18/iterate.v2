import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensurePRDContent } from "@/lib/prd-schema";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ draftId: string }> }
) {
  const session = await getServerSession(authOptions);
  const orgId = (session?.user as { organizationId?: string } | undefined)?.organizationId;
  if (!orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { draftId } = await params;
  const draft = await prisma.pRDDraft.findFirst({
    where: { id: draftId, organizationId: orgId },
  });

  if (!draft) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: draft.id,
    title: draft.title,
    content: ensurePRDContent(draft.content),
    markdownContent: draft.markdownContent ?? null,
    seedConversationId: draft.seedConversationId,
    createdAt: draft.createdAt.toISOString(),
    updatedAt: draft.updatedAt.toISOString(),
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ draftId: string }> }
) {
  const session = await getServerSession(authOptions);
  const orgId = (session?.user as { organizationId?: string } | undefined)?.organizationId;
  if (!orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { draftId } = await params;
  const existing = await prisma.pRDDraft.findFirst({
    where: { id: draftId, organizationId: orgId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: { title?: string; content?: object; markdownContent?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data: { title?: string; content?: object; markdownContent?: string } = {};
  if (typeof body.title === "string") data.title = body.title;
  if (body.content !== undefined && body.content !== null && typeof body.content === "object") {
    data.content = body.content;
  }
  if (typeof body.markdownContent === "string") data.markdownContent = body.markdownContent;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({
      id: existing.id,
      title: existing.title,
      content: ensurePRDContent(existing.content),
      markdownContent: existing.markdownContent ?? null,
      updatedAt: existing.updatedAt.toISOString(),
    });
  }

  const draft = await prisma.pRDDraft.update({
    where: { id: draftId },
    data,
  });

  return NextResponse.json({
    id: draft.id,
    title: draft.title,
    content: ensurePRDContent(draft.content),
    markdownContent: draft.markdownContent ?? null,
    updatedAt: draft.updatedAt.toISOString(),
  });
}
