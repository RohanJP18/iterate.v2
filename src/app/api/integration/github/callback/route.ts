import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/encrypt";

const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const orgId = (session?.user as { organizationId?: string } | undefined)?.organizationId;
  if (!orgId) {
    return NextResponse.redirect(new URL("/login", baseUrl()));
  }

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/integration?error=github_denied`, baseUrl())
    );
  }

  if (state !== orgId) {
    return NextResponse.redirect(
      new URL("/integration?error=github_invalid_state", baseUrl())
    );
  }

  if (!code?.trim()) {
    return NextResponse.redirect(
      new URL("/integration?error=github_no_code", baseUrl())
    );
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      new URL("/integration?error=github_not_configured", baseUrl())
    );
  }

  const redirectUri = `${baseUrl()}/api/integration/github/callback`;
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code: code.trim(),
    redirect_uri: redirectUri,
  });

  const tokenRes = await fetch(GITHUB_TOKEN_URL, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const data = (await tokenRes.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!data.access_token) {
    return NextResponse.redirect(
      new URL("/integration?error=github_token_failed", baseUrl())
    );
  }

  const encryptedToken = encrypt(data.access_token);

  await prisma.integration.upsert({
    where: { organizationId_type: { organizationId: orgId, type: "github" } },
    create: {
      organizationId: orgId,
      type: "github",
      encryptedAccessToken: encryptedToken,
    },
    update: {
      encryptedAccessToken: encryptedToken,
    },
  });

  return NextResponse.redirect(new URL("/integration?github=connected", baseUrl()));
}

function baseUrl(): string {
  return process.env.NEXTAUTH_URL ?? "http://localhost:3000";
}
