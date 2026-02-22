import type { RRWebEvent, CriticalMoment } from "./types";
import { MOMENT_PRIORITY } from "./types";

const CATEGORY_MATCH_WINDOW_MS = 15_000;

export function getCategoryForTimestamp(
  timestampSeconds: number,
  moments: CriticalMoment[]
): string {
  const tsMs = timestampSeconds * 1000;
  let best: CriticalMoment | null = null;
  let bestDelta = CATEGORY_MATCH_WINDOW_MS + 1;
  for (const m of moments) {
    const reason = m.reason ?? m.kind;
    if (reason === "session_start" || reason === "session_end") continue;
    const delta = Math.abs(m.timestampMs - tsMs);
    if (delta <= CATEGORY_MATCH_WINDOW_MS && delta < bestDelta) {
      bestDelta = delta;
      best = m;
    }
  }
  return best ? (best.reason ?? best.kind) : "other";
}

const RAGE_WINDOW_MS = 2000;
const RAGE_MIN_CLICKS = 3;
const LONG_PAUSE_MS = 30_000;
const INPUT_BEFORE_ERROR_MS = 10_000;
const DEDUPE_WINDOW_MS = 5000;

/**
 * Detects critical moments in a session (errors, rage clicks, long pauses, etc.)
 * and returns a deduplicated list with timestamps and reasons.
 */
export function detectCriticalMoments(
  events: RRWebEvent[],
  firstTs: number,
  durationSeconds?: number
): CriticalMoment[] {
  const arr = Array.isArray(events) ? (events as RRWebEvent[]) : [];
  if (arr.length === 0) {
    return [
      { timestampMs: 0, kind: "session_start", reason: "session_start" },
      {
        timestampMs: (durationSeconds ?? 0) * 1000,
        kind: "session_end",
        reason: "session_end",
      },
    ];
  }

  const moments: CriticalMoment[] = [];
  const lastTs = (arr[arr.length - 1]?.timestamp ?? firstTs) as number;

  // 1. Console / log events: type 5 (custom) or type 3 source 8 (log)
  for (let i = 0; i < arr.length; i++) {
    const ev = arr[i];
    const ts = (ev.timestamp ?? 0) as number;
    const type = ev.type;
    const data = ev.data as Record<string, unknown> | undefined;
    if (type === 5) {
      const level = (data?.level as string) ?? "log";
      const reason = level === "error" ? "console_error" : "console_log";
      moments.push({ timestampMs: ts, kind: reason, reason, eventIndex: i });
    } else if (type === 3 && data?.source === 8) {
      const reason = "console_log";
      moments.push({ timestampMs: ts, kind: reason, reason, eventIndex: i });
    }
  }

  // 2. Input then error: if we have an input (source 3) within 10s before a log/error, error moment already in list; optionally tag. Skip for now (error already captured).

  // 3. Rage / repeated clicks: 3+ mouse (source 1) in 2s window
  for (let i = 0; i < arr.length; i++) {
    const ev = arr[i];
    if (ev.type !== 3) continue;
    const data = ev.data as Record<string, unknown> | undefined;
    if (data?.source !== 1) continue;
    const ts = (ev.timestamp ?? 0) as number;
    let count = 1;
    for (let j = i + 1; j < arr.length; j++) {
      const next = arr[j];
      const nextTs = (next.timestamp ?? 0) as number;
      if (nextTs - ts > RAGE_WINDOW_MS) break;
      if (next.type === 3 && (next.data as Record<string, unknown>)?.source === 1) count++;
    }
    if (count >= RAGE_MIN_CLICKS) {
      moments.push({
        timestampMs: ts,
        kind: "repeated_clicks",
        reason: "repeated_clicks",
        eventIndex: i,
      });
      i += RAGE_MIN_CLICKS - 1;
    }
  }

  // 4. Long pause: gap > 30s between consecutive events
  for (let i = 1; i < arr.length; i++) {
    const prev = arr[i - 1];
    const next = arr[i];
    const prevTs = (prev.timestamp ?? 0) as number;
    const nextTs = (next.timestamp ?? 0) as number;
    if (nextTs - prevTs > LONG_PAUSE_MS) {
      moments.push({
        timestampMs: prevTs,
        kind: "long_pause",
        reason: "long_pause",
        eventIndex: i - 1,
      });
    }
  }

  // 5. Always include session start and end
  moments.push({ timestampMs: firstTs, kind: "session_start", reason: "session_start" });
  moments.push({ timestampMs: lastTs, kind: "session_end", reason: "session_end" });

  return dedupeMoments(moments);
}

function dedupeMoments(moments: CriticalMoment[]): CriticalMoment[] {
  // Sort by time, then merge: within DEDUPE_WINDOW_MS keep highest-priority
  const sorted = [...moments].sort((a, b) => a.timestampMs - b.timestampMs);
  const merged: CriticalMoment[] = [];
  for (const m of sorted) {
    const nearby = merged.find(
      (x) => Math.abs(x.timestampMs - m.timestampMs) <= DEDUPE_WINDOW_MS
    );
    if (!nearby) {
      merged.push(m);
      continue;
    }
    const nearPriority = MOMENT_PRIORITY[nearby.reason ?? ""] ?? 0;
    const mPriority = MOMENT_PRIORITY[m.reason ?? ""] ?? 0;
    if (mPriority > nearPriority) {
      const idx = merged.indexOf(nearby);
      merged[idx] = m;
    }
  }
  return merged.sort((a, b) => a.timestampMs - b.timestampMs);
}
