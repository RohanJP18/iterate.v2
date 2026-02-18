"use client";

import { useState, useEffect } from "react";
import { ReplayPlayer } from "@/components/ReplayPlayer";

type IssueListItem = {
  id: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  firstDetectedAt: string;
  suggestedFeature: string | null;
  affectedCount: number;
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

export default function IssuesPage() {
  const [filter, setFilter] = useState<"critical" | "all" | "resolved">("critical");
  const [issues, setIssues] = useState<IssueListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<IssueDetail | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [integration, setIntegration] = useState<IntegrationStatus | null>(null);

  const [counts, setCounts] = useState({ critical: 0, all: 0, resolved: 0 });
  const [replayModal, setReplayModal] = useState<{
    sessionRecordingId: string;
    timestampSeconds: number;
    posthogUrl: string | null;
  } | null>(null);
  const criticalCount = counts.critical;
  const allCount = counts.all;
  const resolvedCount = counts.resolved;

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
        setIssues(data.issues ?? []);
        if (data.counts) setCounts(data.counts);
        if (!selectedId && (data.issues?.length ?? 0) > 0) setSelectedId(data.issues[0].id);
        else if (data.issues?.length === 0) setSelectedId(null);
      })
      .catch(() => setIssues([]))
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
    setIssues((prev) => prev.map((i) => (i.id === detail.id ? { ...i, status: "resolved" } : i)));
  }

  const getRecordingUrl = (posthogRecordingId: string, timestampSeconds: number) => {
    if (!integration?.projectId) return null;
    const host = integration.host ?? "us.posthog.com";
    const base = host.startsWith("http") ? host : `https://${host}`;
    return `${base}/project/${integration.projectId}/replay/${posthogRecordingId}?t=${timestampSeconds}`;
  };

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center gap-2">
        <svg className="h-5 w-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <h1 className="text-lg font-semibold text-charcoal">Issues</h1>
      </div>
      <div className="mb-4 flex gap-2">
        {(["critical", "all", "resolved"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              filter === f
                ? "bg-gray-200 text-charcoal"
                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {f === "critical" && `Critical (${criticalCount})`}
            {f === "all" && `All (${allCount})`}
            {f === "resolved" && `Resolved (${resolvedCount})`}
          </button>
        ))}
      </div>

      <div className="flex flex-1 min-h-0 gap-4">
        <div className="w-96 shrink-0 flex flex-col rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="border-b border-gray-200 px-4 py-2 text-xs font-medium uppercase tracking-wide text-gray-500">
            {filter === "critical" && `Critical issues (${issues.length})`}
            {filter === "all" && `All issues (${issues.length})`}
            {filter === "resolved" && `Resolved (${issues.length})`}
          </div>
          <div className="flex-1 overflow-y-auto">
            {loadingList ? (
              <div className="p-4 text-sm text-gray-500">Loading...</div>
            ) : issues.length === 0 ? (
              <div className="p-4 text-sm text-gray-500">No issues</div>
            ) : (
              issues.map((issue) => (
                <button
                  key={issue.id}
                  type="button"
                  onClick={() => setSelectedId(issue.id)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 ${
                    selectedId === issue.id ? "bg-gray-100" : ""
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <svg className="h-4 w-4 shrink-0 text-red-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-charcoal truncate">{issue.title}</div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          issue.severity === "critical" ? "bg-red-100 text-red-800" : "bg-gray-100 text-gray-700"
                        }`}>
                          {issue.severity}
                        </span>
                        <span className="text-xs text-gray-500">{issue.affectedCount} sessions</span>
                        <span className="text-xs text-gray-400">{formatTimeAgo(issue.firstDetectedAt)}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{issue.description}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0 rounded-xl border border-gray-200 bg-white overflow-hidden flex flex-col">
          {loadingDetail ? (
            <div className="p-6 text-gray-500">Loading...</div>
          ) : !detail ? (
            <div className="p-6 text-gray-500">Select an issue</div>
          ) : (
            <>
              <div className="border-b border-gray-200 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-charcoal">{detail.title}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs px-2 py-1 rounded ${
                        detail.severity === "critical" ? "bg-red-100 text-red-800" : "bg-gray-100 text-gray-700"
                      }`}>
                        {detail.severity}
                      </span>
                      <span className="text-sm text-gray-500">
                        First detected {new Date(detail.firstDetectedAt).toLocaleDateString()}
                      </span>
                      <span className="text-sm text-gray-500">{detail.affectedCount} affected sessions</span>
                    </div>
                  </div>
                  {detail.status === "open" && (
                    <button
                      type="button"
                      onClick={handleMarkResolved}
                      className="shrink-0 inline-flex items-center gap-2 rounded-lg bg-charcoal px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
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
                  <span className="text-sm font-medium text-charcoal">Issue Description</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    detail.status === "resolved" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
                  }`}>
                    {detail.status === "resolved" ? "Resolved" : "Unresolved"}
                  </span>
                </div>
                <p className="text-sm text-gray-700">{detail.description}</p>
                {detail.suggestedFeature && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Suggested feature</div>
                    <p className="text-sm text-gray-600 mt-1">{detail.suggestedFeature}</p>
                  </div>
                )}
              </div>
              <div className="p-6 flex-1 overflow-auto">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="h-4 w-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  <span className="text-sm font-medium text-charcoal">Related Sessions</span>
                </div>
                {detail.relatedSessions.length === 0 ? (
                  <p className="text-sm text-gray-500">Loading sessions...</p>
                ) : (
                  <ul className="space-y-2">
                    {detail.relatedSessions.map((s) => {
                      const url = getRecordingUrl(s.posthogRecordingId, s.timestampSeconds);
                      return (
                        <li key={s.id} className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
                          <div>
                            <span className="text-sm text-gray-600">
                              Session at {formatTimestamp(s.timestampSeconds)}
                            </span>
                            {s.snippet && (
                              <p className="text-xs text-gray-500 mt-1 line-clamp-1">{s.snippet}</p>
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
                            className="shrink-0 rounded-lg bg-charcoal px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800"
                          >
                            View recording at {formatTimestamp(s.timestampSeconds)}
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
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
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
