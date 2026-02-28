"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { DeleteDraftButton } from "@/components/DeleteDraftButton";
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
      <div className="mb-4 flex shrink-0 items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <svg className="h-5 w-5 text-charcoal dark:text-gray-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h1 className="text-lg font-semibold text-charcoal dark:text-gray-100">PRD Generator</h1>
        </div>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          — Create and refine a product requirements document. Chat with the agent to add or edit sections, or edit the canvas directly.
        </span>
      </div>

      {!draftId ? (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between gap-4 mb-6">
            <h2 className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Your PRDs
            </h2>
            <button
              type="button"
              onClick={handleNewBlank}
              className="rounded-lg bg-charcoal dark:bg-gray-100 dark:text-charcoal px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 dark:hover:bg-gray-200"
            >
              + New PRD
            </button>
          </div>
          {loadingDrafts ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
              <button
                type="button"
                onClick={handleNewBlank}
                className="rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-600 bg-white dark:bg-[#252525] hover:border-gray-300 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700/50 min-h-[160px] flex flex-col items-center justify-center gap-2 text-gray-500 dark:text-gray-400 hover:text-charcoal dark:hover:text-gray-200 transition-colors"
              >
                <span className="text-3xl font-light leading-none">+</span>
                <span className="text-sm font-medium">New PRD</span>
              </button>
              {drafts.map((d) => (
                <div
                  key={d.id}
                  className="relative rounded-lg border border-gray-100 dark:border-gray-700 bg-white dark:bg-[#252525] overflow-hidden hover:border-gray-200 dark:hover:border-gray-600 hover:shadow-sm transition-all min-h-[160px] flex flex-col"
                >
                  <DeleteDraftButton
                    draftId={d.id}
                    onDeleted={() => {
                      setDrafts((prev) => prev.filter((x) => x.id !== d.id));
                      if (draftId === d.id) {
                        setDraftId(null);
                        window.history.replaceState(null, "", "/prd");
                      }
                    }}
                  />
                  <Link href={`/prd?draftId=${d.id}`} className="flex-1 flex flex-col">
                    <div className="h-20 shrink-0 bg-gray-50 dark:bg-gray-800 flex items-center justify-center">
                      <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="p-3 flex-1 flex flex-col min-w-0">
                      <span className="font-semibold text-charcoal dark:text-gray-100 truncate">
                        {d.title || "Untitled"}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Updated {new Date(d.updatedAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        }).toUpperCase()}
                      </span>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          )}
          <p className="mt-auto pt-6 text-center text-sm text-gray-500 dark:text-gray-400">
            <Link href="/feature-gen" className="underline hover:text-charcoal dark:hover:text-gray-300">
              Go to Feature Gen
            </Link>
            {" "}to send a conversation here.
          </p>
        </div>
      ) : (
        <div className="flex-1 flex min-h-0 overflow-hidden">
          <div className="flex-1 min-w-0 min-h-0 flex flex-col rounded-lg border border-gray-100 dark:border-gray-800 bg-white dark:bg-[#252525] overflow-hidden flex-shrink-0">
            <div className="border-b border-gray-100 dark:border-gray-700 px-4 py-2 flex items-center justify-between gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Chat</span>
              <div className="flex items-center gap-1.5">
                {hasCanvasContent && !canvasOpen && (
                  <button
                    type="button"
                    onClick={() => setCanvasOpen(true)}
                    className="rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-800 px-3 py-1.5 text-xs font-medium text-charcoal dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-1"
                  >
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Show PRD
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleGeneratePRD}
                  disabled={isStreamingDoc}
                  className="rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-800 px-3 py-1.5 text-xs font-medium text-charcoal dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 flex items-center gap-1"
                >
                  {isStreamingDoc ? "Generating…" : "Generate PRD"}
                </button>
                <a
                  href={`/api/prd/drafts/${draftId}/export`}
                  download={`prd-${draftId}.json`}
                  className="rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-800 px-3 py-1.5 text-xs font-medium text-charcoal dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-1"
                >
                  Export for CLI
                </a>
              </div>
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
              className="flex flex-col rounded-lg border border-gray-100 dark:border-gray-800 bg-white dark:bg-[#252525] overflow-hidden border-l-0 rounded-l-none flex-shrink-0 transition-[width] duration-300 ease-out min-h-0"
              style={{ width: canvasOpen ? "min(50%, 640px)" : 0 }}
            >
              <div className="border-b border-gray-100 dark:border-gray-700 px-4 py-2 flex items-center justify-between gap-2 shrink-0">
                <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 truncate">
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
                  <div className="p-4 text-sm text-gray-500 dark:text-gray-400">Loading...</div>
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
