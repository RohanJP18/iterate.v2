"use client";

import { useState, useEffect } from "react";

type Status = { connected: boolean; projectId?: string; host?: string };
type LastRun = { startedAt: string; finishedAt: string | null; recordingsProcessed: number; issuesCreated: number | null } | null;

export default function IntegrationPage() {
  const [apiKey, setApiKey] = useState("");
  const [projectId, setProjectId] = useState("");
  const [host, setHost] = useState("us.posthog.com");
  const [status, setStatus] = useState<Status | null>(null);
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
    fetchLastRun();
    fetchRecordingCount();
  }, []);

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
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-gray-500 font-mono text-sm">// INTEGRATION</h1>
      </div>
      <div className="max-w-xl space-y-6">
        {status && (
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="text-sm font-medium text-gray-700">PostHog connection</div>
            <p className="mt-1 text-sm text-gray-500">
              {status.connected
                ? `Connected (Project: ${status.projectId}${status.host ? `, Host: ${status.host}` : ""})`
                : "Not connected"}
            </p>
          </div>
        )}
        <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
          <h2 className="text-base font-semibold text-charcoal">PostHog</h2>
          <p className="text-sm text-gray-500">
            Use a personal API key with <code className="rounded bg-gray-100 px-1">session_recording:read</code> scope.
          </p>
          <div>
            <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700">
              API key
            </label>
            <input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="phx_..."
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-charcoal shadow-sm focus:border-[#0ea5e9] focus:outline-none focus:ring-1 focus:ring-[#0ea5e9]"
            />
          </div>
          <div>
            <label htmlFor="projectId" className="block text-sm font-medium text-gray-700">
              Project ID
            </label>
            <input
              id="projectId"
              type="text"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              placeholder="12345"
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-charcoal shadow-sm focus:border-[#0ea5e9] focus:outline-none focus:ring-1 focus:ring-[#0ea5e9]"
            />
          </div>
          <div>
            <label htmlFor="host" className="block text-sm font-medium text-gray-700">
              Host (optional)
            </label>
            <input
              id="host"
              type="text"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="us.posthog.com"
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-charcoal shadow-sm focus:border-[#0ea5e9] focus:outline-none focus:ring-1 focus:ring-[#0ea5e9]"
            />
          </div>
          {message && (
            <p className={`text-sm ${message.type === "ok" ? "text-green-600" : "text-red-600"}`}>
              {message.text}
            </p>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleTest}
              disabled={loading}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Test connection
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={loading}
              className="rounded-lg bg-charcoal px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </div>
        {status?.connected && (
          <>
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="text-base font-semibold text-charcoal">Sync recordings</h2>
              <p className="mt-1 text-sm text-gray-500">
                Fetch session recordings from PostHog.
              </p>
              <button
                type="button"
                onClick={handleSyncNow}
                disabled={loading}
                className="mt-4 rounded-lg bg-charcoal px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
              >
                Sync now
              </button>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="text-base font-semibold text-charcoal">Run analysis</h2>
              <p className="mt-1 text-sm text-gray-500">
                Analyze recordings with AI to detect UX bugs and suggest features.
              </p>
              {recordingCount !== null && (
                <p className="mt-2 text-sm text-gray-600">
                  {recordingCount} recording{recordingCount !== 1 ? "s" : ""} available for analysis.
                </p>
              )}
              <button
                type="button"
                onClick={handleRunAnalysis}
                disabled={loading}
                className="mt-4 rounded-lg bg-charcoal px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
              >
                Run analysis
              </button>
              {lastRun && (
                <p className="mt-3 text-sm text-gray-500">
                  Last run: {new Date(lastRun.startedAt).toLocaleString()} — {lastRun.recordingsProcessed} recordings, {lastRun.issuesCreated ?? 0} new issues
                </p>
              )}
              {lastRun === null && status?.connected && (
                <p className="mt-3 text-sm text-gray-500">No run yet</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
