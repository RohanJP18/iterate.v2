"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type PRDDocCanvasProps = {
  draftId: string | null;
  initialMarkdown: string;
  onMarkdownChange?: (markdown: string) => void;
  /** Accumulated streamed content while generating (parent appends chunks here) */
  streamedContent?: string;
  isStreaming?: boolean;
};

const DEBOUNCE_MS = 600;

export function PRDDocCanvas({
  draftId,
  initialMarkdown,
  onMarkdownChange,
  streamedContent = "",
  isStreaming = false,
}: PRDDocCanvasProps) {
  const [markdown, setMarkdown] = useState(initialMarkdown);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<"preview" | "edit">("preview");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isStreaming) {
      setMarkdown(initialMarkdown);
    }
  }, [initialMarkdown, isStreaming]);

  const displayValue = isStreaming ? streamedContent : markdown;

  const persist = useCallback(
    async (value: string) => {
      if (!draftId) return;
      setSaving(true);
      try {
        const res = await fetch(`/api/prd/drafts/${draftId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ markdownContent: value }),
        });
        if (!res.ok) throw new Error("Failed to save");
        onMarkdownChange?.(value);
      } finally {
        setSaving(false);
      }
    },
    [draftId, onMarkdownChange]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setMarkdown(value);
      onMarkdownChange?.(value);
      if (draftId) {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          persist(value);
          debounceRef.current = null;
        }, DEBOUNCE_MS);
      }
    },
    [draftId, onMarkdownChange, persist]
  );

  const handleBlur = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      persist(markdown);
      debounceRef.current = null;
    }
  }, [markdown, persist]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    if (isStreaming) {
      if (viewMode === "edit" && textareaRef.current) {
        textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
      }
      if (viewMode === "preview" && scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
      }
    }
  }, [displayValue, isStreaming, viewMode]);

  const isEmpty = !displayValue.trim();

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-1.5 border-b border-gray-100">
        {saving && <span className="text-xs text-gray-500">Saving…</span>}
        <div className="flex gap-1 ml-auto">
          <button
            type="button"
            onClick={() => setViewMode("preview")}
            className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
              viewMode === "preview"
                ? "bg-charcoal text-white"
                : "text-gray-500 hover:bg-gray-100 hover:text-charcoal"
            }`}
          >
            Preview
          </button>
          <button
            type="button"
            onClick={() => setViewMode("edit")}
            className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
              viewMode === "edit"
                ? "bg-charcoal text-white"
                : "text-gray-500 hover:bg-gray-100 hover:text-charcoal"
            }`}
          >
            Edit
          </button>
        </div>
      </div>
      <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-auto p-4">
        {viewMode === "edit" ? (
          <textarea
            ref={textareaRef}
            value={displayValue}
            onChange={handleChange}
            onBlur={handleBlur}
            disabled={isStreaming}
            placeholder="Ask the agent to generate a PRD, or click Generate PRD after discovery."
            className="w-full min-h-full font-mono text-sm text-charcoal placeholder:text-gray-400 border-0 bg-transparent resize-none focus:outline-none focus:ring-0 disabled:opacity-90"
            spellCheck={false}
            rows={20}
          />
        ) : (
          <div className="prd-doc-preview min-h-full text-charcoal text-sm [&_h1]:text-lg [&_h1]:font-bold [&_h1]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-4 [&_h2]:mb-1 [&_h2]:pb-1 [&_h2]:border-b [&_h2]:border-gray-200 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1 [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 [&_strong]:font-bold [&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-gray-300 [&_th]:px-3 [&_th]:py-1.5 [&_th]:bg-gray-50 [&_th]:text-left [&_th]:font-semibold [&_td]:border [&_td]:border-gray-300 [&_td]:px-3 [&_td]:py-1.5 [&_tr]:border-b [&_tr]:border-gray-200">
            {isEmpty ? (
              <p className="text-gray-400">No content yet. Ask the agent to generate a PRD, or switch to Edit to type.</p>
            ) : (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayValue}</ReactMarkdown>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
