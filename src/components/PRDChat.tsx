"use client";

import { useState, useRef, useEffect } from "react";

type PRDMessage = {
  id: string;
  role: string;
  content: string;
  createdAt: string;
};

type PRDChatProps = {
  draftId: string | null;
  messages: PRDMessage[];
  onMessagesUpdate: (messages: PRDMessage[]) => void;
  onContentUpdate?: (content: object) => void;
  currentCanvasMarkdown?: string;
  onDocUpdate?: (doc: string | null) => void;
};

export function PRDChat({ draftId, messages, onMessagesUpdate, onContentUpdate, currentCanvasMarkdown = "", onDocUpdate }: PRDChatProps) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || !draftId) return;
    setInput("");
    setLoading(true);
    const userMsg: PRDMessage = {
      id: `temp-user-${Date.now()}`,
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    onMessagesUpdate([...messages, userMsg]);

    try {
      const res = await fetch(`/api/prd/drafts/${draftId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, currentCanvasMarkdown }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to send");
      }
      const newMessages = data.messages ?? [];
      onMessagesUpdate([...messages.filter((m) => !m.id.startsWith("temp-")), ...newMessages]);
      if (data.updatedDoc != null) {
        onDocUpdate?.(data.updatedDoc);
      }
      if (data.content) {
        onContentUpdate?.(data.content);
      }
    } catch (e) {
      onMessagesUpdate(messages.filter((m) => m.id !== userMsg.id));
      setInput(text);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!draftId) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-gray-500 text-sm p-4">
        Select or create a draft to chat.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <p className="text-sm text-gray-500">
            Ask discovery questions, then say &quot;Draft it&quot; or click Generate PRD to create the document.
          </p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-xl px-4 py-3 text-sm whitespace-pre-wrap break-words ${
                  m.role === "user"
                    ? "bg-charcoal text-white"
                    : "bg-gray-100 text-charcoal border border-gray-200"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))
        )}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-xl bg-gray-100 border border-gray-200 px-4 py-3 text-sm text-gray-500">
              Thinking...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="border-t border-gray-200 p-4 shrink-0">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask to add or edit PRD sections..."
            rows={2}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-charcoal placeholder:text-gray-400 focus:border-[#0ea5e9] focus:outline-none focus:ring-1 focus:ring-[#0ea5e9] resize-none"
            disabled={loading}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="shrink-0 flex items-center justify-center w-10 h-10 rounded-lg text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
            style={{ backgroundColor: "#c75a38" }}
            aria-label="Send"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
