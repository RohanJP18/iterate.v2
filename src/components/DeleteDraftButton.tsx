"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type DeleteDraftButtonProps = {
  draftId: string;
  onDeleted?: () => void;
};

export function DeleteDraftButton({ draftId, onDeleted }: DeleteDraftButtonProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Delete this PRD? This cannot be undone.")) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/prd/drafts/${draftId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to delete PRD");
      }
      if (onDeleted) {
        onDeleted();
      } else {
        router.refresh();
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete PRD");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={loading}
      className="absolute top-2 right-2 rounded-full bg-white/80 dark:bg-[#252525]/80 border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-red-600 hover:border-red-300 dark:hover:text-red-400 dark:hover:border-red-500 p-1 shadow-sm disabled:opacity-50"
      aria-label="Delete PRD"
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 7h12M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2m-7 4v6m4-6v6M5 7l1 12a2 2 0 002 2h8a2 2 0 002-2l1-12" />
      </svg>
    </button>
  );
}

