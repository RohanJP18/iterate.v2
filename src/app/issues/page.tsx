"use client";

import { useState, useEffect } from "react";
import { ReplayPlayer } from "@/components/ReplayPlayer";

type IssueListItem = {
  id: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  category?: string | null;
  firstDetectedAt: string;
  suggestedFeature: string | null;
  affectedCount: number;
};

type IssueGroup = {
  id: string;
  issues: IssueListItem[];
};

type IssueDetail = IssueListItem & {
  relatedSessions: Array<{
    id: string;
    sessionRecordingId: string;
    timestampSeconds: number;
    snippet: string | null;
    posthogRecordingId: string;
    posthogSessionId: string;
    startedAt: string;
    durationSeconds: number;
  }>;
  affectedCount: number;
};

type IntegrationStatus = { connected: boolean; projectId?: string; host?: string };

function formatTimeAgo(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sec = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (sec < 60) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 604800) return `${Math.floor(sec / 86400)}d ago`;
  return d.toLocaleDateString();
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}:${s.toString().padStart(2, "0")}` : `0:${s.toString().padStart(2, "0")}`;
}

const CATEGORY_LABELS: Record<string, string> = {
  console_error: "Console Errors",
  repeated_clicks: "Repeated Clicks",
  long_pause: "Long Pause",
  console_log: "Console Logs",
  other: "Other",
};

export default function IssuesPage() {
  const [filter, setFilter] = useState<"all" | "resolved">("all");
  const [groups, setGroups] = useState<IssueGroup[]>([]);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<IssueDetail | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [integration, setIntegration] = useState<IntegrationStatus | null>(null);

  const [counts, setCounts] = useState({ all: 0, resolved: 0 });
  const [clearing, setClearing] = useState(false);
  const [replayModal, setReplayModal] = useState<{
    sessionRecordingId: string;
    timestampSeconds: number;
    posthogUrl: string | null;
  } | null>(null);

  useEffect(() => {
    fetch("/api/integration/posthog")
      .then((r) => r.json())
      .then((data) => setIntegration({ connected: data.connected, projectId: data.projectId, host: data.host }))
      .catch(() => setIntegration({ connected: false }));
  }, []);

  useEffect(() => {
    setLoadingList(true);
    fetch(`/api/issues?filter=${filter}`)
      .then((r) => r.json())
      .then((data) => {
        const nextGroups = data.groups ?? [];
        setGroups(nextGroups);
        if (data.counts) setCounts(data.counts);
        const firstIssueId = nextGroups.length > 0 && nextGroups[0].issues.length > 0
          ? nextGroups[0].issues[0].id
          : null;
        setSelectedId(firstIssueId);
      })
      .catch(() => setGroups([]))
      .finally(() => setLoadingList(false));
  }, [filter]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    setLoadingDetail(true);
    fetch(`/api/issues/${selectedId}`)
      .then((r) => r.json())
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setLoadingDetail(false));
  }, [selectedId]);

  async function handleMarkResolved() {
    if (!detail) return;
    await fetch(`/api/issues/${detail.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "resolved" }),
    });
    setDetail((d) => (d ? { ...d, status: "resolved" } : null));
    setGroups((prev) =>
      prev.map((g) => ({
        ...g,
        issues: g.issues.map((i) => (i.id === detail.id ? { ...i, status: "resolved" } : i)),
      }))
    );
  }

  async function handleClearAllIssues() {
    if (counts.all === 0) return;
    if (!confirm(`Clear all ${counts.all} issue(s)? This cannot be undone. You can re-run analysis to regenerate issues.`)) {
      return;
    }
    setClearing(true);
    try {
      const res = await fetch("/api/issues/clear", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to clear");
      setGroups([]);
      setCounts({ all: 0, resolved: 0 });
      setSelectedId(null);
      setDetail(null);
      setExpandedGroupId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to clear issues");
    } finally {
      setClearing(false);
    }
  }

  const getRecordingUrl = (posthogRecordingId: string, timestampSeconds: number) => {
    if (!integration?.projectId) return null;
    const host = integration.host ?? "us.posthog.com";
    const base = host.startsWith("http") ? host : `https://${host}`;
    return `${base}/project/${integration.projectId}/replay/${posthogRecordingId}?t=${timestampSeconds}`;
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-4 flex items-center gap-2">
        <svg className="h-5 w-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <h1 className="text-lg font-semibold text-charcoal dark:text-gray-100">Issues</h1>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(["all", "resolved"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              filter === f
                ? "bg-gray-200 dark:bg-gray-600 text-charcoal dark:text-gray-100"
                : "bg-white dark:bg-[#252525] border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            }`}
          >
            {f === "all" && `All (${counts.all})`}
            {f === "resolved" && `Resolved (${counts.resolved})`}
          </button>
        ))}
        {counts.all > 0 && (
          <button
            type="button"
            onClick={handleClearAllIssues}
            disabled={clearing}
            className="rounded-lg border border-red-200 dark:border-red-800 bg-white dark:bg-[#252525] px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50"
          >
            {clearing ? "Clearing…" : "Clear all issues"}
          </button>
        )}
      </div>

      <div className="flex flex-1 min-h-0 gap-4">
        <div className="w-96 shrink-0 flex flex-col rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#252525] overflow-hidden">
          <div className="border-b border-gray-200 dark:border-gray-700 px-4 py-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {filter === "all" && `Issue groups (${groups.length})`}
            {filter === "resolved" && `Resolved (${groups.length})`}
          </div>
          <div className="flex-1 overflow-y-auto">
            {loadingList ? (
              <div className="p-4 text-sm text-gray-500 dark:text-gray-400">Loading...</div>
            ) : groups.length === 0 ? (
              <div className="p-4 text-sm text-gray-500 dark:text-gray-400">No issues</div>
            ) : (
              groups.map((group) => {
                const first = group.issues[0];
                const totalSessions = group.issues.reduce((s, i) => s + i.affectedCount, 0);
                const isExpanded = expandedGroupId === group.id;
                return (
                  <div key={group.id} className="border-b border-gray-100">
                    <button
                      type="button"
                      onClick={() => setExpandedGroupId((id) => (id === group.id ? null : group.id))}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-start gap-2"
                    >
                      <span className="shrink-0 text-gray-400 mt-0.5">
                        {isExpanded ? (
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        ) : (
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        )}
                      </span>
                      <svg className="h-4 w-4 shrink-0 text-red-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-charcoal dark:text-gray-100 truncate">
                          {group.issues.length > 1
                            ? `${first.category && CATEGORY_LABELS[first.category] ? CATEGORY_LABELS[first.category] : first.title} (${group.issues.length} similar)`
                            : first.title}
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            first.severity === "critical" ? "bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300" : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                          }`}>
                            {first.severity}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">{totalSessions} sessions</span>
                          <span className="text-xs text-gray-400 dark:text-gray-500">{formatTimeAgo(first.firstDetectedAt)}</span>
                        </div>
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="bg-gray-50/80 dark:bg-gray-800/50 pl-4 pr-2 pb-2">
                        {group.issues.map((issue) => (
                          <button
                            key={issue.id}
                            type="button"
                            onClick={() => setSelectedId(issue.id)}
                            className={`w-full text-left px-3 py-2 rounded-lg border border-transparent hover:bg-white dark:hover:bg-gray-700 hover:border-gray-200 dark:hover:border-gray-600 ${
                              selectedId === issue.id ? "bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600" : ""
                            }`}
                          >
                            <div className="font-medium text-sm text-charcoal dark:text-gray-100 truncate">{issue.title}</div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-gray-500 dark:text-gray-400">{issue.affectedCount} sessions</span>
                              <span className="text-xs text-gray-400 dark:text-gray-500">{formatTimeAgo(issue.firstDetectedAt)}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#252525] overflow-hidden flex flex-col">
          {loadingDetail ? (
            <div className="p-6 text-gray-500 dark:text-gray-400">Loading...</div>
          ) : !detail ? (
            <div className="p-6 text-gray-500 dark:text-gray-400">Select an issue</div>
          ) : (
            <>
              <div className="border-b border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-charcoal dark:text-gray-100">{detail.title}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs px-2 py-1 rounded ${
                        detail.severity === "critical" ? "bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300" : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                      }`}>
                        {detail.severity}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        First detected {new Date(detail.firstDetectedAt).toLocaleDateString()}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">{detail.affectedCount} affected sessions</span>
                    </div>
                  </div>
                  {detail.status === "open" && (
                    <button
                      type="button"
                      onClick={handleMarkResolved}
                      className="shrink-0 inline-flex items-center gap-2 rounded-lg bg-charcoal dark:bg-gray-100 dark:text-charcoal px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 dark:hover:bg-gray-200"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Mark Resolved
                    </button>
                  )}
                </div>
              </div>
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="h-4 w-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span className="text-sm font-medium text-charcoal dark:text-gray-100">Issue Description</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    detail.status === "resolved" ? "bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300" : "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300"
                  }`}>
                    {detail.status === "resolved" ? "Resolved" : "Unresolved"}
                  </span>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300">{detail.description}</p>
                {detail.suggestedFeature && (
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Suggested feature</div>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{detail.suggestedFeature}</p>
                  </div>
                )}
              </div>
              <div className="p-6 flex-1 overflow-auto">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="h-4 w-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  <span className="text-sm font-medium text-charcoal dark:text-gray-100">Related Sessions</span>
                </div>
                {detail.relatedSessions.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">Loading sessions...</p>
                ) : (
                  <ul className="space-y-2">
                    {detail.relatedSessions.map((s) => {
                      const url = getRecordingUrl(s.posthogRecordingId, s.timestampSeconds);
                      return (
                        <li key={s.id} className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-600 p-3">
                          <div>
                            <span className="text-sm text-gray-600 dark:text-gray-300">
                              Session at {s.timestampSeconds > 0 ? formatTimestamp(s.timestampSeconds) : "start"}
                            </span>
                            {s.snippet && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">{s.snippet}</p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setReplayModal({
                                sessionRecordingId: s.sessionRecordingId,
                                timestampSeconds: s.timestampSeconds,
                                posthogUrl: url,
                              })
                            }
                            className="shrink-0 rounded-lg bg-charcoal dark:bg-gray-100 dark:text-charcoal px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 dark:hover:bg-gray-200"
                          >
                            View recording{s.timestampSeconds > 0 ? ` at ${formatTimestamp(s.timestampSeconds)}` : ""}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      {replayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-[#252525] rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <ReplayPlayer
              sessionRecordingId={replayModal.sessionRecordingId}
              timestampSeconds={replayModal.timestampSeconds}
              posthogUrl={replayModal.posthogUrl}
              onClose={() => setReplayModal(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
