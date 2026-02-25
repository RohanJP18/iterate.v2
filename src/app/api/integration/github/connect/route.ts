import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const GITHUB_AUTH_URL = "https://github.com/login/oauth/authorize";
const SCOPE = "repo,read:user";

export async function GET() {
  const session = await getServerSession(authOptions);
  const orgId = (session?.user as { organizationId?: string } | undefined)?.organizationId;
  if (!orgId) {
    return NextResponse.redirect(new URL("/login", baseUrl()));
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return NextResponse.redirect(
      new URL("/integration?error=github_not_configured", baseUrl())
    );
  }

  const redirectUri = `${baseUrl()}/api/integration/github/callback`;
  const state = orgId;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: SCOPE,
    state,
  });

  return NextResponse.redirect(`${GITHUB_AUTH_URL}?${params.toString()}`);
}

function baseUrl(): string {
  return process.env.NEXTAUTH_URL ?? "http://localhost:3000";
}
