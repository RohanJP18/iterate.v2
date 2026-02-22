import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { unlink } from "fs/promises";
import path from "path";

export async function GET() {
  const session = await getServerSession(authOptions);
  const orgId = (session?.user as { organizationId?: string } | undefined)?.organizationId;
  if (!orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const files = await prisma.uploadedFile.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: "desc" },
    select: { id: true, filename: true, mimeType: true, fileSize: true, createdAt: true },
  });

  return NextResponse.json({
    files: files.map((f) => ({
      id: f.id,
      filename: f.filename,
      mimeType: f.mimeType,
      fileSize: f.fileSize,
      createdAt: f.createdAt.toISOString(),
    })),
  });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  const orgId = (session?.user as { organizationId?: string } | undefined)?.organizationId;
  if (!orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { id?: string };
  try {
    body = await req.json().catch(() => ({}));
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const fileId = typeof body.id === "string" ? body.id : null;
  if (!fileId) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const file = await prisma.uploadedFile.findFirst({
    where: { id: fileId, organizationId: orgId },
  });

  if (!file) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const absolutePath = path.isAbsolute(file.filePath) ? file.filePath : path.join(process.cwd(), file.filePath);
  try {
    await unlink(absolutePath);
  } catch (e) {
    console.warn("Could not delete file from disk:", absolutePath, e);
  }

  await prisma.uploadedFile.delete({ where: { id: file.id } });
  return NextResponse.json({ ok: true });
}
