"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

type Conversation = {
  id: string;
  title: string | null;
  createdAt: string;
};

type AttachedFile = {
  id: string;
  filename: string;
};

export function FeatureGenChat() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [sendingToPrd, setSendingToPrd] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    fetch("/api/feature-gen/conversations")
      .then((r) => r.json())
      .then((data) => {
        const list = data.conversations ?? [];
        setConversations(list);
        if (list.length > 0 && !currentConversationId) {
          setCurrentConversationId(list[0].id);
        }
        setLoadingConversations(false);
      })
      .catch(() => setLoadingConversations(false));
  }, []);

  useEffect(() => {
    if (!currentConversationId) {
      setMessages([]);
      return;
    }
    fetch(`/api/feature-gen/conversations/${currentConversationId}`)
      .then((r) => r.json())
      .then((data) => {
        setMessages(data.messages ?? []);
      })
      .catch(() => setMessages([]));
  }, [currentConversationId]);

  const handleNewConversation = () => {
    setCurrentConversationId(null);
    setMessages([]);
    setInput("");
    setAttachedFiles([]);
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text && attachedFiles.length === 0) return;
    setLoading(true);
    const userMessage = text || "(No message — attached files only)";
    setInput("");
    const fileIds = attachedFiles.map((f) => f.id);
    setAttachedFiles([]);

    setMessages((prev) => [
      ...prev,
      {
        id: `temp-${Date.now()}`,
        role: "user",
        content: userMessage,
        createdAt: new Date().toISOString(),
      },
    ]);

    try {
      const res = await fetch("/api/feature-gen/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: currentConversationId,
          message: userMessage,
          fileIds: fileIds.length ? fileIds : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to send message");
      }
      if (data.conversationId && !currentConversationId) {
        setCurrentConversationId(data.conversationId);
        setConversations((prev) => [
          { id: data.conversationId, title: data.title ?? "New chat", createdAt: new Date().toISOString() },
          ...prev,
        ]);
      }
      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => !m.id.startsWith("temp-"));
        return [
          ...withoutTemp,
          ...(data.messages ?? []),
        ];
      });
    } catch (e) {
      setMessages((prev) => prev.filter((m) => !m.id.startsWith("temp-")));
      setInput(userMessage);
      setAttachedFiles(fileIds.map((id) => ({ id, filename: "file" })));
      alert(e instanceof Error ? e.message : "Failed to send message");
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append("files", files[i]);
    }
    setLoading(true);
    fetch("/api/feature-gen/upload", {
      method: "POST",
      body: formData,
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.files) {
          setAttachedFiles((prev) => [
            ...prev,
            ...data.files.map((f: { id: string; filename: string }) => ({ id: f.id, filename: f.filename })),
          ]);
        }
        if (data.error) throw new Error(data.error);
      })
      .catch((err) => alert(err.message ?? "Upload failed"))
      .finally(() => {
        setLoading(false);
        e.target.value = "";
      });
  };

  const removeAttachment = (id: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleSendToPRD = async () => {
    if (!currentConversationId || messages.length === 0) return;
    setSendingToPrd(true);
    try {
      const res = await fetch("/api/prd/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: currentConversationId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to create PRD draft");
      if (data.draftId) router.push(`/prd?draftId=${data.draftId}`);
    } catch {
      setSendingToPrd(false);
    }
  };

  return (
    <div className="flex flex-1 min-h-0 max-w-3xl mx-auto w-full rounded-xl border border-gray-200 bg-white flex-col overflow-hidden">
      <div className="flex border-b border-gray-200 shrink-0 items-center justify-between">
        <div className="flex">
          <button
            type="button"
            onClick={handleNewConversation}
            className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-charcoal"
          >
            New chat
          </button>
        {conversations.length > 0 && (
          <div className="flex gap-1 p-2 overflow-x-auto">
            {conversations.slice(0, 10).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCurrentConversationId(c.id)}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  currentConversationId === c.id
                    ? "bg-[#7dd3fc]/20 text-[#0ea5e9]"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {c.title || "Untitled"}
              </button>
            ))}
          </div>
        )}
        </div>
        {currentConversationId && messages.length > 0 && (
          <button
            type="button"
            onClick={handleSendToPRD}
            disabled={sendingToPrd}
            className="shrink-0 mx-2 rounded-lg border border-[#0ea5e9] bg-[#7dd3fc]/20 px-3 py-2 text-sm font-medium text-[#0ea5e9] hover:bg-[#7dd3fc]/30 disabled:opacity-50"
          >
            {sendingToPrd ? "Sending…" : "Send to PRD Generator"}
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4">
        {loadingConversations && messages.length === 0 ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-gray-500">
            Start a conversation. Ask for a feature outline based on your PostHog data, or attach customer interview
            PDFs/videos.
          </p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-xl px-4 py-3 text-sm ${
                  m.role === "user"
                    ? "bg-charcoal text-white"
                    : "bg-gray-100 text-charcoal border border-gray-200"
                }`}
              >
                <div className="whitespace-pre-wrap break-words">{m.content}</div>
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
        {attachedFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {attachedFiles.map((f) => (
              <span
                key={f.id}
                className="inline-flex items-center gap-1 rounded-lg bg-[#7dd3fc]/20 px-2.5 py-1 text-xs font-medium text-[#0ea5e9]"
              >
                {f.filename}
                <button
                  type="button"
                  onClick={() => removeAttachment(f.id)}
                  className="hover:opacity-80"
                  aria-label="Remove"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.mp4,.mp3,.m4a,.webm"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Attach
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask for a feature outline..."
            rows={2}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-charcoal placeholder:text-gray-400 focus:border-[#0ea5e9] focus:outline-none focus:ring-1 focus:ring-[#0ea5e9] resize-none"
            disabled={loading}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={loading || (!input.trim() && attachedFiles.length === 0)}
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
