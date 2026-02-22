import type { RRWebEvent, CriticalMoment, EnrichedContext, SessionMetadata } from "./types";

const DEFAULT_WINDOW_SECONDS = 15;
const DEFAULT_MAX_EVENTS_PER_WINDOW = 80;
const MAX_PAYLOAD_CHARS = 200;

export type EnrichOptions = {
  windowSeconds?: number;
  maxEventsPerWindow?: number;
};

/**
 * Builds enriched text context per critical moment and a session summary.
 * Pure function: no DB or API calls.
 */
export function buildEnrichedContext(
  events: RRWebEvent[],
  criticalMoments: CriticalMoment[],
  firstTs: number,
  options: EnrichOptions = {},
  metadata?: SessionMetadata | null
): { enriched: EnrichedContext[]; sessionSummary: string } {
  const windowSeconds = options.windowSeconds ?? DEFAULT_WINDOW_SECONDS;
  const maxEvents = options.maxEventsPerWindow ?? DEFAULT_MAX_EVENTS_PER_WINDOW;
  const windowMs = windowSeconds * 1000;

  const enriched: EnrichedContext[] = [];

  for (let i = 0; i < criticalMoments.length; i++) {
    const moment = criticalMoments[i];
    const start = Math.max(firstTs, moment.timestampMs - windowMs);
    const end = moment.timestampMs + windowMs;
    const inWindow = events.filter((ev) => {
      const t = (ev.timestamp ?? 0) as number;
      return t >= start && t <= end;
    });

    if (i === 0) {
      const sampleTs = events.slice(0, 5).map((ev) => (ev.timestamp ?? 0) as number);
      console.log("[analyze/enrich] First moment window", {
        momentSec: (moment.timestampMs - firstTs) / 1000,
        kind: moment.kind,
        windowStartMs: start,
        windowEndMs: end,
        inWindowCount: inWindow.length,
        totalEvents: events.length,
        sampleEventTimestamps: sampleTs,
      });
    }

    const prioritized = prioritizeEvents(inWindow);
    const capped = prioritized.slice(0, maxEvents);
    const lines = capped.map((ev) => eventToLine(ev, firstTs));
    const contextText = lines.join("\n");

    enriched.push({
      momentTimestampMs: moment.timestampMs,
      kind: moment.kind,
      contextText: contextText || `(no events in window around ${(moment.timestampMs - firstTs) / 1000}s)`,
    });
  }

  const sessionSummary = buildSessionSummary(
    events,
    firstTs,
    criticalMoments,
    metadata
  );

  return { enriched, sessionSummary };
}

/** Priority: custom (5) > log (8) > input (3) > mouse (1) > scroll (2) > mutation (0) and rest */
function prioritizeEvents(events: RRWebEvent[]): RRWebEvent[] {
  const score = (ev: RRWebEvent): number => {
    const type = ev.type ?? -1;
    const data = ev.data as Record<string, unknown> | undefined;
    const source = (data?.source as number) ?? -1;
    if (type === 5) return 100;
    if (type === 3 && source === 8) return 90;
    if (type === 3 && source === 3) return 80;
    if (type === 3 && source === 1) return 70;
    if (type === 3 && source === 2) return 60;
    if (type === 2) return 50;
    if (type === 3 && source === 0) return 10;
    return 5;
  };
  return [...events].sort((a, b) => score(b) - score(a));
}

function eventToLine(ev: RRWebEvent, firstTs: number): string {
  const ts = (ev.timestamp ?? 0) as number;
  const sec = Math.max(0, (ts - firstTs) / 1000);
  const secStr = sec.toFixed(1) + "s";
  const type = ev.type ?? -1;
  const data = ev.data as Record<string, unknown> | undefined;

  if (type === 5) {
    const level = (data?.level as string) ?? "log";
    const payload = formatPayload(data?.payload ?? data?.message ?? data);
    return `${secStr}: [console] ${level} ${payload}`;
  }

  if (type === 3 && data?.source !== undefined) {
    const source = data.source as number;
    if (source === 8) {
      const payload = formatPayload(data.payload ?? data.message);
      return `${secStr}: [log] ${payload}`;
    }
    if (source === 1) {
      const x = data.x as number | undefined;
      const y = data.y as number | undefined;
      const coords =
        x !== undefined && y !== undefined ? ` at (${Math.round(x)},${Math.round(y)})` : "";
      return `${secStr}: mouse/click${coords}`;
    }
    if (source === 3) {
      const text = data.text as string | undefined;
      const len = typeof text === "string" ? text.length : 0;
      return `${secStr}: input (value length ${len})`;
    }
    if (source === 2) {
      return `${secStr}: scroll`;
    }
    if (source === 0) {
      return `${secStr}: DOM mutation`;
    }
    return `${secStr}: incremental_${source}`;
  }

  if (type === 2) return sec === 0 ? "0s: full_snapshot (page load)" : `${secStr}: full_snapshot`;
  if (type === 0) return `${secStr}: dom_content_loaded`;
  if (type === 1) return `${secStr}: load`;

  return `${secStr}: event_type_${type}`;
}

function formatPayload(payload: unknown): string {
  if (payload == null) return "";
  if (typeof payload === "string") {
    return payload.length > MAX_PAYLOAD_CHARS
      ? payload.slice(0, MAX_PAYLOAD_CHARS) + "..."
      : payload;
  }
  try {
    const s = JSON.stringify(payload);
    return s.length > MAX_PAYLOAD_CHARS ? s.slice(0, MAX_PAYLOAD_CHARS) + "..." : s;
  } catch {
    return String(payload).slice(0, MAX_PAYLOAD_CHARS);
  }
}

function buildSessionSummary(
  events: RRWebEvent[],
  firstTs: number,
  moments: CriticalMoment[],
  metadata?: SessionMetadata | null
): string {
  const durationSec = metadata?.durationSeconds ?? 0;
  const mins = Math.floor(durationSec / 60);
  const secs = durationSec % 60;
  const durationStr =
    mins > 0 ? `${mins} min ${secs} s` : `${durationSec} s`;

  const clicks = metadata?.click_count ?? 0;
  const keypresses = metadata?.keypress_count ?? 0;
  const errors = metadata?.console_error_count ?? 0;
  const warns = metadata?.console_warn_count ?? 0;

  const parts: string[] = [
    `Session: duration ${durationStr}.`,
    `Activity: ${clicks} clicks, ${keypresses} keypresses.`,
  ];
  if (errors > 0) parts.push(`Console errors: ${errors}.`);
  if (warns > 0) parts.push(`Console warnings: ${warns}.`);

  const momentSummaries = moments
    .filter((m) => m.reason && m.reason !== "session_start" && m.reason !== "session_end")
    .map((m) => {
      const s = (m.timestampMs - firstTs) / 1000;
      return `${m.reason} at ${s.toFixed(0)}s`;
    });
  if (momentSummaries.length > 0) {
    parts.push("Critical moments: " + momentSummaries.join("; ") + ".");
  }

  return parts.join(" ");
}
