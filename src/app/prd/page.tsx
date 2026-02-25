"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { PRDChat } from "@/components/PRDChat";
import { PRDDocCanvas } from "@/components/PRDDocCanvas";

type DraftSummary = { id: string; title: string; updatedAt: string };
type PRDMessage = { id: string; role: string; content: string; createdAt: string };

export default function PRDPage() {
  const searchParams = useSearchParams();
  const draftIdParam = searchParams.get("draftId");

  const [drafts, setDrafts] = useState<DraftSummary[]>([]);
  const [draftId, setDraftId] = useState<string | null>(draftIdParam);
  const [title, setTitle] = useState<string>("");
  const [markdownContent, setMarkdownContent] = useState<string>("");
  const [messages, setMessages] = useState<PRDMessage[]>([]);
  const [loadingDrafts, setLoadingDrafts] = useState(true);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [isStreamingDoc, setIsStreamingDoc] = useState(false);
  const [streamedContent, setStreamedContent] = useState("");
  const [canvasOpen, setCanvasOpen] = useState(false);

  useEffect(() => {
    setDraftId(draftIdParam);
  }, [draftIdParam]);

  useEffect(() => {
    fetch("/api/prd/drafts")
      .then((r) => r.json())
      .then((data) => {
        setDrafts(data.drafts ?? []);
        setLoadingDrafts(false);
      })
      .catch(() => setLoadingDrafts(false));
  }, []);

  useEffect(() => {
    if (!draftId) {
      setMessages([]);
      setTitle("");
      setMarkdownContent("");
      return;
    }
    setLoadingDraft(true);
    Promise.all([
      fetch(`/api/prd/drafts/${draftId}`).then((r) => r.json()),
      fetch(`/api/prd/drafts/${draftId}/messages`).then((r) => r.json()),
    ])
      .then(([draftData, messagesData]) => {
        if (draftData.error) {
          setDraftId(null);
          return;
        }
        setTitle(draftData.title ?? "");
        setMarkdownContent(draftData.markdownContent ?? "");
        setMessages(messagesData.messages ?? []);
      })
      .catch(() => setDraftId(null))
      .finally(() => setLoadingDraft(false));
  }, [draftId]);

  const handleNewBlank = async () => {
    const res = await fetch("/api/prd/drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json().catch(() => ({}));
    if (data.draftId) {
      window.history.replaceState(null, "", `/prd?draftId=${data.draftId}`);
      setDraftId(data.draftId);
      setDrafts((prev) => [{ id: data.draftId, title: data.title ?? "New PRD", updatedAt: new Date().toISOString() }, ...prev]);
    }
  };

  const handleGeneratePRD = useCallback(async () => {
    if (!draftId) return;
    setIsStreamingDoc(true);
    setStreamedContent("");
    try {
      const res = await fetch(`/api/prd/drafts/${draftId}/generate-doc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationHistory: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      if (!res.ok || !res.body) {
        throw new Error("Failed to start generation");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;
        setStreamedContent(accumulated);
      }
      setMarkdownContent(accumulated);
      await fetch(`/api/prd/drafts/${draftId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markdownContent: accumulated }),
      });
    } catch (e) {
      console.error("Generate PRD error:", e);
    } finally {
      setIsStreamingDoc(false);
      setStreamedContent("");
    }
  }, [draftId, messages, markdownContent]);

  const hasCanvasContent = isStreamingDoc || (markdownContent?.trim().length ?? 0) > 0;

  useEffect(() => {
    if (isStreamingDoc && hasCanvasContent) {
      const t = requestAnimationFrame(() => setCanvasOpen(true));
      return () => cancelAnimationFrame(t);
    }
  }, [isStreamingDoc, hasCanvasContent]);

  const handleDocUpdate = useCallback((doc: string | null) => {
    if (doc !== null) {
      setMarkdownContent(doc);
      setCanvasOpen(true);
    }
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-4 flex shrink-0 items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <svg className="h-5 w-5 text-charcoal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h1 className="text-lg font-semibold text-charcoal">PRD Generator</h1>
        </div>
        {draftId && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleGeneratePRD}
              disabled={isStreamingDoc}
              className="rounded-lg bg-charcoal px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {isStreamingDoc ? "Generating…" : "Generate PRD"}
            </button>
            <a
              href={`/api/prd/drafts/${draftId}/export`}
              download={`prd-${draftId}.json`}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Export for CLI
            </a>
          </div>
        )}
      </div>
      <p className="mb-4 shrink-0 text-sm text-gray-500">
        Create and refine a product requirements document. Chat with the agent to add or edit sections, or edit the canvas directly.
      </p>

      {!draftId ? (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="text-sm font-medium text-charcoal mb-2">Drafts</h2>
            {loadingDrafts ? (
              <p className="text-sm text-gray-500">Loading...</p>
            ) : drafts.length === 0 ? (
              <p className="text-sm text-gray-500 mb-4">No drafts yet.</p>
            ) : (
              <ul className="space-y-2 mb-4">
                {drafts.map((d) => (
                  <li key={d.id}>
                    <Link
                      href={`/prd?draftId=${d.id}`}
                      className="block rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium text-charcoal hover:bg-gray-50"
                    >
                      {d.title || "Untitled"} · {new Date(d.updatedAt).toLocaleDateString()}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleNewBlank}
                className="rounded-lg bg-charcoal px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
              >
                New blank PRD
              </button>
              <Link
                href="/feature-gen"
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Go to Feature Gen to send a conversation here
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex min-h-0 overflow-hidden">
          <div className="flex-1 min-w-0 min-h-0 flex flex-col rounded-xl border border-gray-200 bg-white overflow-hidden flex-shrink-0">
            <div className="border-b border-gray-200 px-4 py-2 flex items-center justify-between gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Chat</span>
              {hasCanvasContent && !canvasOpen && (
                <button
                  type="button"
                  onClick={() => setCanvasOpen(true)}
                  className="text-xs font-medium text-charcoal hover:text-gray-600 flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Show PRD
                </button>
              )}
            </div>
            {loadingDraft ? (
              <div className="p-4 text-sm text-gray-500">Loading draft...</div>
            ) : (
              <div className="flex-1 min-h-0 flex flex-col">
                <PRDChat
                  draftId={draftId}
                  messages={messages}
                  onMessagesUpdate={setMessages}
                  currentCanvasMarkdown={markdownContent}
                  onDocUpdate={handleDocUpdate}
                />
              </div>
            )}
          </div>
          {hasCanvasContent && (
            <div
              className="flex flex-col rounded-xl border border-gray-200 bg-white overflow-hidden border-l-0 rounded-l-none flex-shrink-0 transition-[width] duration-300 ease-out min-h-0"
              style={{ width: canvasOpen ? "min(50%, 640px)" : 0 }}
            >
              <div className="border-b border-gray-200 px-4 py-2 flex items-center justify-between gap-2 shrink-0">
                <span className="text-xs font-medium uppercase tracking-wide text-gray-500 truncate">
                  {title || "PRD Canvas"}
                </span>
                <button
                  type="button"
                  onClick={() => setCanvasOpen(false)}
                  className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 hover:text-charcoal transition-colors"
                  aria-label="Collapse canvas"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden min-w-0">
                {loadingDraft ? (
                  <div className="p-4 text-sm text-gray-500">Loading...</div>
                ) : (
                  <PRDDocCanvas
                    draftId={draftId}
                    initialMarkdown={markdownContent}
                    onMarkdownChange={setMarkdownContent}
                    streamedContent={streamedContent}
                    isStreaming={isStreamingDoc}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
