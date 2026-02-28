import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Deletes all issues for the current organization. IssueSessions are removed by cascade. */
export async function POST() {
  const session = await getServerSession(authOptions);
  const orgId = (session?.user as { organizationId?: string } | undefined)?.organizationId;
  if (!orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await prisma.issue.deleteMany({
    where: { organizationId: orgId },
  });

  return NextResponse.json({
    ok: true,
    deleted: result.count,
  });
}
