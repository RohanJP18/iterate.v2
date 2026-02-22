import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildPostHogContext } from "@/lib/feature-gen-context";
import { generateFeatureResponse } from "@/lib/feature-gen-agent";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const orgId = (session?.user as { organizationId?: string } | undefined)?.organizationId;
  if (!orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { conversationId?: string; message?: string; fileIds?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  const fileIds = Array.isArray(body.fileIds) ? body.fileIds.filter((id) => typeof id === "string") : [];
  let conversationId = typeof body.conversationId === "string" ? body.conversationId : null;

  if (!message && fileIds.length === 0) {
    return NextResponse.json({ error: "Message or file attachments required" }, { status: 400 });
  }

  const userContent = message || "(No message — attached files only)";

  let conversation = conversationId
    ? await prisma.conversation.findFirst({
        where: { id: conversationId, organizationId: orgId },
      })
    : null;

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        organizationId: orgId,
        title: userContent.slice(0, 80) + (userContent.length > 80 ? "…" : ""),
      },
    });
    conversationId = conversation.id;
  }

  const [postHogContext, files] = await Promise.all([
    buildPostHogContext(orgId),
    fileIds.length > 0
      ? prisma.uploadedFile.findMany({
          where: { id: { in: fileIds }, organizationId: orgId },
          select: { filename: true, transcript: true },
        })
      : [],
  ]);

  const fileTranscripts = files
    .map((f) => `### ${f.filename}\n${f.transcript ?? "(no transcript)"}`)
    .join("\n\n");

  let assistantText: string;
  try {
    assistantText = await generateFeatureResponse({
      userMessage: userContent,
      postHogContext,
      fileTranscripts,
    });
  } catch (e) {
    console.error("Feature gen agent error:", e);
    return NextResponse.json(
      { error: "AI request failed. Check OPENAI_API_KEY and try again." },
      { status: 500 }
    );
  }

  const [userMsg, assistantMsg] = await prisma.$transaction([
    prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "user",
        content: userContent,
      },
    }),
    prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "assistant",
        content: assistantText,
      },
    }),
  ]);

  return NextResponse.json({
    conversationId: conversation.id,
    title: conversation.title ?? undefined,
    messages: [
      {
        id: userMsg.id,
        role: userMsg.role as "user",
        content: userMsg.content,
        createdAt: userMsg.createdAt.toISOString(),
      },
      {
        id: assistantMsg.id,
        role: assistantMsg.role as "assistant",
        content: assistantMsg.content,
        createdAt: assistantMsg.createdAt.toISOString(),
      },
    ],
  });
}
