import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generatePRDArchitectResponse } from "@/lib/prd-architect-agent";

export async function POST(
  req: Request,
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
    include: {
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!draft) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: { message?: string; currentCanvasMarkdown?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    return NextResponse.json({ error: "Message required" }, { status: 400 });
  }

  const currentCanvasMarkdown =
    typeof body.currentCanvasMarkdown === "string" ? body.currentCanvasMarkdown : (draft.markdownContent ?? "");

  const conversationHistory = draft.messages.map((m) => ({ role: m.role, content: m.content }));

  let assistantMessage: string;
  let updatedDoc: string | null = null;

  try {
    const result = await generatePRDArchitectResponse({
      userMessage: message,
      conversationHistory,
      currentCanvasMarkdown,
    });
    assistantMessage = result.assistantMessage;
    updatedDoc = result.updatedDoc;
  } catch (e) {
    console.error("PRD architect agent error:", e);
    return NextResponse.json(
      { error: "AI request failed. Check OPENAI_API_KEY and try again." },
      { status: 500 }
    );
  }

  const [userMsg, assistantMsg] = await prisma.$transaction([
    prisma.pRDMessage.create({
      data: { prdDraftId: draftId, role: "user", content: message },
    }),
    prisma.pRDMessage.create({
      data: { prdDraftId: draftId, role: "assistant", content: assistantMessage },
    }),
  ]);

  if (updatedDoc !== null) {
    await prisma.pRDDraft.update({
      where: { id: draftId },
      data: { markdownContent: updatedDoc },
    });
  }

  return NextResponse.json({
    messages: [
      {
        id: userMsg.id,
        role: userMsg.role,
        content: userMsg.content,
        createdAt: userMsg.createdAt.toISOString(),
      },
      {
        id: assistantMsg.id,
        role: assistantMsg.role,
        content: assistantMsg.content,
        createdAt: assistantMsg.createdAt.toISOString(),
      },
    ],
    updatedDoc,
  });
}
