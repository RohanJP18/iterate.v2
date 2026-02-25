import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getRepoContext } from "@/lib/github";
import { prisma } from "@/lib/prisma";
import { streamPRDDocument } from "@/lib/prd-architect-agent";

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
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!draft) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: { conversationHistory?: { role: string; content: string }[] };
  try {
    body = await req.json().catch(() => ({}));
  } catch {
    body = {};
  }

  const conversationHistory =
    Array.isArray(body.conversationHistory) &&
    body.conversationHistory.every(
      (m): m is { role: string; content: string } =>
        m != null && typeof m.role === "string" && typeof m.content === "string"
    )
      ? body.conversationHistory
      : draft.messages.map((m) => ({ role: m.role, content: m.content }));

  const repoContext = await getRepoContext(orgId);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of streamPRDDocument(conversationHistory, repoContext || undefined)) {
          controller.enqueue(encoder.encode(chunk));
        }
      } catch (e) {
        console.error("generate-doc stream error:", e);
        controller.enqueue(encoder.encode("\n\n[Error generating document. Please try again.]"));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
    },
  });
}
