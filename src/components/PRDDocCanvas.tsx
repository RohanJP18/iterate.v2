"use client";

import { useState, useEffect, useRef, useCallback } from "react";

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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    if (isStreaming && textareaRef.current) {
      textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
    }
  }, [displayValue, isStreaming]);

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {saving && (
        <div className="shrink-0 px-4 py-1 text-xs text-gray-500 border-b border-gray-100">
          Saving…
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-auto p-4">
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
      </div>
    </div>
  );
}
