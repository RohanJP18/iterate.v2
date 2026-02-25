"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";

type Status = { connected: boolean; projectId?: string; host?: string };
type LinkedRepo = { owner: string; repo: string } | null;
type LastRun = { startedAt: string; finishedAt: string | null; recordingsProcessed: number; issuesCreated: number | null } | null;

export default function IntegrationPage() {
  const searchParams = useSearchParams();
  const [apiKey, setApiKey] = useState("");
  const [projectId, setProjectId] = useState("");
  const [host, setHost] = useState("us.posthog.com");
  const [status, setStatus] = useState<Status | null>(null);
  const [githubConnected, setGithubConnected] = useState<boolean | null>(null);
  const [linkedRepo, setLinkedRepo] = useState<LinkedRepo>(null);
  const [linkOwner, setLinkOwner] = useState("");
  const [linkRepo, setLinkRepo] = useState("");
  const [lastRun, setLastRun] = useState<LastRun>(null);
  const [recordingCount, setRecordingCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  function fetchLastRun() {
    fetch("/api/analyze/last-run")
      .then((r) => r.json())
      .then((data) => setLastRun(data.run ?? null))
      .catch(() => setLastRun(null));
  }

  function fetchRecordingCount() {
    fetch("/api/recordings/count")
      .then((r) => r.json())
      .then((data) => setRecordingCount(typeof data.count === "number" ? data.count : null))
      .catch(() => setRecordingCount(null));
  }

  useEffect(() => {
    fetch("/api/integration/posthog")
      .then((r) => r.json())
      .then((data) => setStatus({ connected: data.connected, projectId: data.projectId, host: data.host }))
      .catch(() => setStatus({ connected: false }));
    fetch("/api/integration/github")
      .then((r) => r.json())
      .then((data) => {
        setGithubConnected(data.connected === true);
        setLinkedRepo(data.linkedRepo ?? null);
        if (data.linkedRepo) {
          setLinkOwner(data.linkedRepo.owner ?? "");
          setLinkRepo(data.linkedRepo.repo ?? "");
        }
      })
      .catch(() => setGithubConnected(false));
    fetchLastRun();
    fetchRecordingCount();
  }, []);

  useEffect(() => {
    const github = searchParams.get("github");
    const error = searchParams.get("error");
    if (github === "connected") {
      setMessage({ type: "ok", text: "GitHub connected successfully." });
      setGithubConnected(true);
      window.history.replaceState(null, "", "/integration");
    } else if (error) {
      const text =
        error === "github_denied"
          ? "GitHub authorization was denied or cancelled."
          : error === "github_not_configured"
            ? "GitHub integration is not configured (missing env)."
            : error === "github_token_failed"
              ? "Failed to get access token from GitHub."
              : "Something went wrong with GitHub.";
      setMessage({ type: "error", text });
      window.history.replaceState(null, "", "/integration");
    }
  }, [searchParams]);

  async function handleTest() {
    setMessage(null);
    setLoading(true);
    try {
      const res = await fetch("/api/integration/posthog/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, projectId, host: host || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setMessage({ type: "ok", text: "Connection successful" });
      } else {
        setMessage({ type: "error", text: data.error ?? "Connection failed" });
      }
    } catch {
      setMessage({ type: "error", text: "Request failed" });
    }
    setLoading(false);
  }

  async function handleSave() {
    setMessage(null);
    setLoading(true);
    try {
      const res = await fetch("/api/integration/posthog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, projectId, host: host || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setMessage({ type: "ok", text: "Saved. You can sync recordings below." });
        setStatus({ connected: true, projectId, host: host || undefined });
        setApiKey("");
      } else {
        setMessage({ type: "error", text: data.error ?? "Save failed" });
      }
    } catch {
      setMessage({ type: "error", text: "Request failed" });
    }
    setLoading(false);
  }

  async function handleSyncNow() {
    setMessage(null);
    setLoading(true);
    try {
      const res = await fetch("/api/sync/trigger", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setMessage({ type: "ok", text: data.message ?? "Sync started" });
      } else {
        setMessage({ type: "error", text: data.error ?? "Sync failed" });
      }
    } catch {
      setMessage({ type: "error", text: "Request failed" });
    }
    setLoading(false);
  }

  async function handleRunAnalysis() {
    setMessage(null);
    setLoading(true);
    try {
      const res = await fetch("/api/analyze/trigger", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setMessage({ type: "ok", text: data.message ?? "Analysis complete" });
        fetchLastRun();
        fetchRecordingCount();
      } else {
        setMessage({ type: "error", text: data.error ?? "Analysis failed" });
      }
    } catch {
      setMessage({ type: "error", text: "Request failed" });
    }
    setLoading(false);
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-charcoal dark:text-gray-100">Integrations</h1>
      </div>
      {message && (
        <p className={`mb-4 text-sm ${message.type === "ok" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
          {message.text}
        </p>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* PostHog */}
        <div className="rounded-lg border border-gray-100 dark:border-gray-800 bg-white dark:bg-[#252525] p-6 flex flex-col">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h2 className="text-base font-semibold text-charcoal dark:text-gray-100">PostHog</h2>
            {status && (
              <span className={`text-xs font-medium ${status.connected ? "text-green-600 dark:text-green-400" : "text-gray-500 dark:text-gray-400"}`}>
                {status.connected ? "Connected" : "Not connected"}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Use a personal API key with <code className="rounded bg-gray-100 dark:bg-gray-700 px-1">session_recording:read</code> scope.
          </p>
          <div className="space-y-3 flex-1">
            <div>
              <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700 dark:text-gray-300">API key</label>
              <input
                id="apiKey"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="phx_..."
                className="mt-1 block w-full rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-800 px-3 py-2.5 text-sm text-charcoal dark:text-gray-100 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
            <div>
              <label htmlFor="projectId" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Project ID</label>
              <input
                id="projectId"
                type="text"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                placeholder="12345"
                className="mt-1 block w-full rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-800 px-3 py-2.5 text-sm text-charcoal dark:text-gray-100 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
            <div>
              <label htmlFor="host" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Host (optional)</label>
              <input
                id="host"
                type="text"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="us.posthog.com"
                className="mt-1 block w-full rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-800 px-3 py-2.5 text-sm text-charcoal dark:text-gray-100 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              type="button"
              onClick={handleTest}
              disabled={loading}
              className="rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-800 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              Test connection
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={loading}
              className="rounded-lg bg-charcoal dark:bg-gray-100 dark:text-charcoal px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </div>

        {/* GitHub */}
        <div className="rounded-lg border border-gray-100 dark:border-gray-800 bg-white dark:bg-[#252525] p-6 flex flex-col">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h2 className="text-base font-semibold text-charcoal dark:text-gray-100">GitHub</h2>
            {githubConnected !== null && (
              <span className={`text-xs font-medium ${githubConnected ? "text-green-600 dark:text-green-400" : "text-gray-500 dark:text-gray-400"}`}>
                {githubConnected ? (linkedRepo ? `${linkedRepo.owner}/${linkedRepo.repo}` : "Connected") : "Not connected"}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Connect your GitHub account to link repos and use PRs or the CLI with your codebase.
          </p>
          <div className="flex-1">
            {githubConnected ? (
              <>
                <div className="space-y-3">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Link a repo for PRD context</p>
                  <div className="flex flex-wrap gap-3 items-end">
                    <div>
                      <label htmlFor="linkOwner" className="block text-xs text-gray-500 dark:text-gray-400">Owner</label>
                      <input
                        id="linkOwner"
                        type="text"
                        value={linkOwner}
                        onChange={(e) => setLinkOwner(e.target.value)}
                        placeholder="my-org"
                        className="mt-0.5 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-800 px-3 py-2 text-sm text-charcoal dark:text-gray-100 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent w-40"
                      />
                    </div>
                    <div>
                      <label htmlFor="linkRepo" className="block text-xs text-gray-500 dark:text-gray-400">Repo</label>
                      <input
                        id="linkRepo"
                        type="text"
                        value={linkRepo}
                        onChange={(e) => setLinkRepo(e.target.value)}
                        placeholder="my-repo"
                        className="mt-0.5 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-800 px-3 py-2 text-sm text-charcoal dark:text-gray-100 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent w-40"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        setMessage(null);
                        setLoading(true);
                        try {
                          const res = await fetch("/api/integration/github", {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ owner: linkOwner.trim(), repo: linkRepo.trim() }),
                          });
                          const data = await res.json().catch(() => ({}));
                          if (res.ok) {
                            setMessage({ type: "ok", text: "Repo linked. PRD Generator will use it for context." });
                            setLinkedRepo(data.linkedRepo ?? { owner: linkOwner.trim(), repo: linkRepo.trim() });
                          } else {
                            setMessage({ type: "error", text: data.error ?? "Failed to link repo" });
                          }
                        } catch {
                          setMessage({ type: "error", text: "Request failed" });
                        }
                        setLoading(false);
                      }}
                      disabled={loading || !linkOwner.trim() || !linkRepo.trim()}
                      className="rounded-lg bg-charcoal dark:bg-gray-100 dark:text-charcoal px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50"
                    >
                      Link repo
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <a
                href="/api/integration/github/connect"
                className="inline-block rounded-lg bg-charcoal dark:bg-gray-100 dark:text-charcoal px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 dark:hover:bg-gray-200"
              >
                Connect GitHub
              </a>
            )}
          </div>
        </div>

        {/* Sync recordings - only when PostHog connected */}
        {status?.connected && (
          <div className="rounded-lg border border-gray-100 dark:border-gray-800 bg-white dark:bg-[#252525] p-6 flex flex-col">
            <h2 className="text-base font-semibold text-charcoal dark:text-gray-100">Sync recordings</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 flex-1">
              Fetch session recordings from PostHog.
            </p>
            <button
              type="button"
              onClick={handleSyncNow}
              disabled={loading}
              className="mt-4 rounded-lg bg-charcoal dark:bg-gray-100 dark:text-charcoal px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50"
            >
              Sync now
            </button>
          </div>
        )}

        {/* Run analysis - only when PostHog connected */}
        {status?.connected && (
          <div className="rounded-lg border border-gray-100 dark:border-gray-800 bg-white dark:bg-[#252525] p-6 flex flex-col">
            <h2 className="text-base font-semibold text-charcoal dark:text-gray-100">Run analysis</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Analyze recordings with AI to detect UX bugs and suggest features.
            </p>
            {recordingCount !== null && (
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                {recordingCount} recording{recordingCount !== 1 ? "s" : ""} available for analysis.
              </p>
            )}
            <button
              type="button"
              onClick={handleRunAnalysis}
              disabled={loading}
              className="mt-4 rounded-lg bg-charcoal dark:bg-gray-100 dark:text-charcoal px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50"
            >
              Run analysis
            </button>
            {lastRun && (
              <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                Last run: {new Date(lastRun.startedAt).toLocaleString()} — {lastRun.recordingsProcessed} recordings, {lastRun.issuesCreated ?? 0} new issues
              </p>
            )}
            {lastRun === null && status?.connected && (
              <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">No run yet</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
