import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import OpenAI from "openai";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_TYPES = [
  "application/pdf",
  "video/mp4",
  "audio/mp3",
  "audio/mpeg",
  "audio/mp4",
  "audio/m4a",
  "video/webm",
];

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const orgId = (session?.user as { organizationId?: string } | undefined)?.organizationId;
  if (!orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const files = formData.getAll("files") as File[];
  if (!files.length) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  const uploadDir = path.join(process.cwd(), "uploads", orgId);
  try {
    await mkdir(uploadDir, { recursive: true });
  } catch (e) {
    console.error("Upload dir creation failed:", e);
    return NextResponse.json({ error: "Failed to create upload directory" }, { status: 500 });
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const results: { id: string; filename: string }[] = [];

  for (const file of files) {
    if (!(file instanceof File)) continue;
    const mimeType = file.type;
    const isAllowed =
      ALLOWED_TYPES.includes(mimeType) ||
      mimeType === "video/mp4" ||
      mimeType === "audio/mp4";
    if (!isAllowed) continue;
    const size = file.size;
    if (size > MAX_FILE_SIZE) continue;

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = path.extname(file.name) || (mimeType.includes("pdf") ? ".pdf" : ".bin");
    const fileId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const filename = file.name || `upload${ext}`;
    const filePath = path.join(uploadDir, `${fileId}${ext}`);

    try {
      await writeFile(filePath, buffer);
    } catch (e) {
      console.error("Write file failed:", e);
      continue;
    }

    let transcript: string | null = null;

    if (mimeType === "application/pdf") {
      try {
        const { PDFParse } = await import("pdf-parse");
        const parser = new PDFParse({ data: new Uint8Array(buffer) });
        const textResult = await parser.getText();
        transcript = (textResult as { text: string }).text ?? "";
        if (typeof (parser as { destroy?: () => Promise<void> }).destroy === "function") {
          await (parser as { destroy: () => Promise<void> }).destroy();
        }
      } catch (e) {
        console.error("PDF parse error:", e);
      }
    }

    if (
      mimeType.startsWith("video/") ||
      mimeType.startsWith("audio/")
    ) {
      try {
        const { createReadStream } = await import("fs");
        const stream = createReadStream(filePath);
        const transcription = await openai.audio.transcriptions.create({
          file: stream as unknown as File,
          model: "whisper-1",
        });
        transcript = transcription.text ?? "";
      } catch (e) {
        console.error("Whisper error:", e);
      }
    }

    const record = await prisma.uploadedFile.create({
      data: {
        organizationId: orgId,
        filename,
        mimeType,
        filePath: path.relative(process.cwd(), filePath),
        transcript,
        fileSize: size,
      },
    });
    results.push({ id: record.id, filename });
  }

  if (results.length === 0) {
    return NextResponse.json(
      { error: "No valid files processed. Allowed: PDF, MP4, MP3, M4A, WebM. Max 50MB each." },
      { status: 400 }
    );
  }

  return NextResponse.json({ files: results });
}
