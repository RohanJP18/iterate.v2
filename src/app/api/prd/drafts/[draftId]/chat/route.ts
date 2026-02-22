import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensurePRDContent } from "@/lib/prd-schema";
import { generatePRDResponse } from "@/lib/prd-agent";
import type { PRDContent } from "@/lib/prd-schema";

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

  let body: { message?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    return NextResponse.json({ error: "Message required" }, { status: 400 });
  }

  const currentContent = ensurePRDContent(draft.content) as PRDContent;
  const conversationHistory = draft.messages.map((m) => ({ role: m.role, content: m.content }));

  let assistantMessage: string;
  let updatedContent: PRDContent = currentContent;

  try {
    const result = await generatePRDResponse({
      userMessage: message,
      conversationHistory,
      currentPRDContent: currentContent,
    });
    assistantMessage = result.assistantMessage;
    if (result.updatedPRDContent) {
      updatedContent = result.updatedPRDContent;
    }
  } catch (e) {
    console.error("PRD agent error:", e);
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

  await prisma.pRDDraft.update({
    where: { id: draftId },
    data: { content: updatedContent as object },
  });

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
    content: updatedContent,
  });
}
