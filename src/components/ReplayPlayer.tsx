"use client";

import { useEffect, useRef, useState } from "react";
import "rrweb/dist/replay/rrweb-replay.css";

type ReplayPlayerProps = {
  sessionRecordingId: string;
  timestampSeconds: number;
  beforeSeconds?: number;
  afterSeconds?: number;
  posthogUrl?: string | null;
  onClose?: () => void;
};

export function ReplayPlayer({
  sessionRecordingId,
  timestampSeconds,
  beforeSeconds = 2,
  afterSeconds = 2,
  posthogUrl,
  onClose,
}: ReplayPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const replayerRef = useRef<{ getCurrentTime: () => number; pause: () => void; destroy?: () => void } | null>(null);
  const [status, setStatus] = useState<"loading" | "playing" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    if (!containerRef.current) return;
    let mounted = true;
    let stopCheckInterval: ReturnType<typeof setInterval> | null = null;

    (async () => {
      try {
        const res = await fetch(`/api/recordings/${sessionRecordingId}/snapshots`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Failed to load recording");
        }
        const data = await res.json();
        const events = data.events as unknown[];
        if (!Array.isArray(events) || events.length === 0) {
          throw new Error("No replay data");
        }
        if (!mounted || !containerRef.current) return;

        const { Replayer } = await import("rrweb");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const replayer = new Replayer(events as any, {
          root: containerRef.current,
          skipInactive: true,
        });
        replayerRef.current = replayer;

        const startMs = Math.max(0, (timestampSeconds - beforeSeconds) * 1000);
        const endMs = (timestampSeconds + afterSeconds) * 1000;
        replayer.play(startMs);

        stopCheckInterval = setInterval(() => {
          if (!mounted || !replayerRef.current) return;
          if (replayer.getCurrentTime() >= endMs) {
            replayer.pause();
            if (stopCheckInterval) clearInterval(stopCheckInterval);
          }
        }, 100);

        if (mounted) setStatus("playing");
      } catch (e) {
        if (mounted) {
          setStatus("error");
          setErrorMessage(e instanceof Error ? e.message : "Failed to load replay");
        }
      }
    })();

    return () => {
      mounted = false;
      if (stopCheckInterval) clearInterval(stopCheckInterval);
      const r = replayerRef.current;
      if (r?.destroy) r.destroy();
    };
  }, [sessionRecordingId, timestampSeconds, beforeSeconds, afterSeconds]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-charcoal">Session replay</h3>
        <div className="flex gap-2">
          {posthogUrl && (
            <a
              href={posthogUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#0ea5e9] hover:underline"
            >
              Open in PostHog
            </a>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-gray-500 hover:text-charcoal"
            >
              Close
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 min-h-0 rounded-lg border border-gray-200 bg-white overflow-hidden relative">
        <div
          ref={containerRef}
          className="w-full h-full overflow-auto"
          style={{ minHeight: 400 }}
        />
        {status === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 text-gray-500 text-sm">
            Loading replay…
          </div>
        )}
        {status === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white text-gray-500 text-sm gap-2 p-4">
            <p>{errorMessage}</p>
            {posthogUrl && (
              <a
                href={posthogUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#0ea5e9] hover:underline"
              >
                Open in PostHog instead
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
