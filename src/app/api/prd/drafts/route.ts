import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDefaultPRDContent, ensurePRDContent } from "@/lib/prd-schema";

export async function GET() {
  const session = await getServerSession(authOptions);
  const orgId = (session?.user as { organizationId?: string } | undefined)?.organizationId;
  if (!orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const drafts = await prisma.pRDDraft.findMany({
    where: { organizationId: orgId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, updatedAt: true },
  });

  return NextResponse.json({
    drafts: drafts.map((d) => ({
      id: d.id,
      title: d.title,
      updatedAt: d.updatedAt.toISOString(),
    })),
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const orgId = (session?.user as { organizationId?: string } | undefined)?.organizationId;
  if (!orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { conversationId?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const conversationId = typeof body.conversationId === "string" ? body.conversationId : null;
  let title = "New PRD draft";
  let seedOverview = "";
  let seedConversationId: string | null = null;

  if (conversationId) {
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, organizationId: orgId },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    if (conversation) {
      title = conversation.title?.slice(0, 80) ?? `PRD from ${new Date(conversation.createdAt).toLocaleDateString()}`;
      seedConversationId = conversation.id;
      seedOverview = conversation.messages
        .map((m) => `[${m.role}]: ${m.content}`)
        .join("\n\n");
    }
  }

  const content = getDefaultPRDContent(seedOverview || undefined);
  const draft = await prisma.pRDDraft.create({
    data: {
      organizationId: orgId,
      title,
      content: content as object,
      seedConversationId,
    },
  });

  return NextResponse.json({
    draftId: draft.id,
    title: draft.title,
  });
}
