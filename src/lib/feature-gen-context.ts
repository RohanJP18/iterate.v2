import { prisma } from "@/lib/prisma";

/**
 * Builds a structured text context from PostHog-related data (issues, session recordings)
 * for the Feature Gen AI agent. Used to ground responses in actual product data.
 */
export async function buildPostHogContext(orgId: string): Promise<string> {
  const [issues, recordings] = await Promise.all([
    prisma.issue.findMany({
      where: { organizationId: orgId },
      include: { _count: { select: { issueSessions: true } } },
      orderBy: { firstDetectedAt: "desc" },
      take: 100,
    }),
    prisma.sessionRecording.findMany({
      where: { organizationId: orgId },
      orderBy: { startedAt: "desc" },
      take: 50,
    }),
  ]);

  const lines: string[] = ["## PostHog / product data (use as evidence for feature suggestions)\n"];

  if (issues.length > 0) {
    lines.push("### Issues (bugs and feature ideas from session analysis)");
    const bySeverity = issues.filter((i) => i.status === "open");
    const critical = bySeverity.filter((i) => i.severity === "critical");
    const withFeature = issues.filter((i) => i.suggestedFeature && i.suggestedFeature.trim().length > 0);
    lines.push(
      `- Total issues: ${issues.length}. Open: ${bySeverity.length}. Critical: ${critical.length}. With feature suggestion: ${withFeature.length}.`
    );
    for (const issue of issues.slice(0, 30)) {
      const sessions = issue._count?.issueSessions ?? 0;
      lines.push(
        `- [Issue ${issue.id}] ${issue.title} (severity: ${issue.severity}, status: ${issue.status}, affected sessions: ${sessions}). Description: ${issue.description.slice(0, 300)}${issue.description.length > 300 ? "…" : ""}`
      );
      if (issue.suggestedFeature) {
        lines.push(`  Suggested feature: ${issue.suggestedFeature.slice(0, 200)}`);
      }
    }
    lines.push("");
  }

  if (recordings.length > 0) {
    lines.push("### Session recordings (recent)");
    const meta = recordings.map((r) => r.metadata as { click_count?: number; console_error_count?: number } | null);
    const totalClicks = meta.reduce((s, m) => s + (m?.click_count ?? 0), 0);
    const totalErrors = meta.reduce((s, m) => s + (m?.console_error_count ?? 0), 0);
    const avgDuration =
      recordings.reduce((s, r) => s + r.durationSeconds, 0) / recordings.length;
    lines.push(
      `- Recordings: ${recordings.length}. Total clicks (metadata): ${totalClicks}. Total console errors: ${totalErrors}. Avg duration: ${Math.round(avgDuration)}s.`
    );
    for (const r of recordings.slice(0, 15)) {
      const m = r.metadata as { click_count?: number; console_error_count?: number } | null;
      lines.push(
        `- Recording ${r.id}: duration ${r.durationSeconds}s, started ${r.startedAt.toISOString()}, clicks ${m?.click_count ?? 0}, errors ${m?.console_error_count ?? 0}.`
      );
    }
    lines.push("");
  }

  if (issues.length === 0 && recordings.length === 0) {
    lines.push("No issues or session recordings found. Sync PostHog and run analysis to populate this data.");
  }

  return lines.join("\n");
}
