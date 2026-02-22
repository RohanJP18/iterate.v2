import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  const orgId = (session?.user as { organizationId?: string } | undefined)?.organizationId;
  if (!orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const conversations = await prisma.conversation.findMany({
    where: { organizationId: orgId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, createdAt: true },
  });

  return NextResponse.json({
    conversations: conversations.map((c) => ({
      id: c.id,
      title: c.title ?? "New chat",
      createdAt: c.createdAt.toISOString(),
    })),
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const orgId = (session?.user as { organizationId?: string } | undefined)?.organizationId;
  if (!orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const conversation = await prisma.conversation.create({
    data: { organizationId: orgId },
  });

  return NextResponse.json({
    id: conversation.id,
    title: conversation.title ?? "New chat",
    createdAt: conversation.createdAt.toISOString(),
  });
}
