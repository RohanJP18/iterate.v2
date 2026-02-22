"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { PRDCanvas } from "@/components/PRDCanvas";
import { PRDChat } from "@/components/PRDChat";
import { ensurePRDContent } from "@/lib/prd-schema";
import type { PRDContent } from "@/lib/prd-schema";

type DraftSummary = { id: string; title: string; updatedAt: string };
type PRDMessage = { id: string; role: string; content: string; createdAt: string };

export default function PRDPage() {
  const searchParams = useSearchParams();
  const draftIdParam = searchParams.get("draftId");

  const [drafts, setDrafts] = useState<DraftSummary[]>([]);
  const [draftId, setDraftId] = useState<string | null>(draftIdParam);
  const [title, setTitle] = useState<string>("");
  const [content, setContent] = useState<PRDContent>(ensurePRDContent(null));
  const [messages, setMessages] = useState<PRDMessage[]>([]);
  const [loadingDrafts, setLoadingDrafts] = useState(true);
  const [loadingDraft, setLoadingDraft] = useState(false);

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
      setContent(ensurePRDContent(null));
      setMessages([]);
      setTitle("");
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
        setContent(ensurePRDContent(draftData.content));
        setMessages(messagesData.messages ?? []);
      })
      .catch(() => setDraftId(null))
      .finally(() => setLoadingDraft(false));
  }, [draftId]);

  const handleContentChange = useCallback((next: PRDContent) => {
    setContent(next);
  }, []);

  const handleSave = useCallback(
    async (next: PRDContent) => {
      if (!draftId) return;
      const res = await fetch(`/api/prd/drafts/${draftId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: next }),
      });
      if (!res.ok) throw new Error("Failed to save");
    },
    [draftId]
  );

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
          <a
            href={`/api/prd/drafts/${draftId}/export`}
            download={`prd-${draftId}.json`}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Export for CLI
          </a>
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
        <div className="flex-1 flex min-h-0 gap-4">
          <div className="w-96 shrink-0 flex flex-col rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="border-b border-gray-200 px-4 py-2 text-xs font-medium uppercase tracking-wide text-gray-500">
              Chat
            </div>
            {loadingDraft ? (
              <div className="p-4 text-sm text-gray-500">Loading draft...</div>
            ) : (
              <div className="flex-1 min-h-0 flex flex-col">
                <PRDChat
                  draftId={draftId}
                  messages={messages}
                  onMessagesUpdate={setMessages}
                  onContentUpdate={(c) => setContent(ensurePRDContent(c))}
                />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0 flex flex-col rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="border-b border-gray-200 px-4 py-2 text-xs font-medium uppercase tracking-wide text-gray-500">
              {title || "PRD Canvas"}
            </div>
            <div className="flex-1 min-h-0 overflow-auto">
              {loadingDraft ? (
                <div className="p-4 text-sm text-gray-500">Loading...</div>
              ) : (
                <PRDCanvas
                  content={content}
                  onChange={handleContentChange}
                  onSave={handleSave}
                  draftId={draftId}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
