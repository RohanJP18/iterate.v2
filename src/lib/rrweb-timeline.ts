const MAX_EVENTS = 100;
const MAX_CHARS = 8000;

type RRWebEvent = {
  type?: number;
  data?: unknown;
  timestamp?: number;
  [key: string]: unknown;
};

const EVENT_LABELS: Record<number, string> = {
  0: "dom_content_loaded",
  1: "load",
  2: "full_snapshot",
  3: "incremental_snapshot",
  4: "meta",
  5: "custom",
};

function eventLabel(ev: RRWebEvent): string {
  const type = ev.type;
  const label = EVENT_LABELS[type ?? -1] ?? `event_${type}`;
  const data = ev.data as Record<string, unknown> | undefined;
  if (type === 3 && data?.source !== undefined) {
    const source = data.source as number;
    const sourceLabels: Record<number, string> = {
      0: "mutation",
      1: "mouse",
      2: "scroll",
      3: "input",
      4: "viewport",
      5: "style",
      6: "canvas",
      7: "font",
      8: "log",
      9: "drag",
      10: "media",
    };
    return `${label}_${sourceLabels[source] ?? source}`;
  }
  return label;
}

export function buildTimelineFromSnapshotEvents(events: unknown[]): string {
  const lines: string[] = [];
  let totalChars = 0;
  const arr = Array.isArray(events) ? events : [];
  for (let i = 0; i < arr.length && i < MAX_EVENTS && totalChars < MAX_CHARS; i++) {
    const ev = arr[i] as RRWebEvent;
    const ts = ev.timestamp ?? 0;
    const sec = Math.floor(ts / 1000);
    const label = eventLabel(ev);
    const line = `${sec}s: ${label}`;
    lines.push(line);
    totalChars += line.length + 1;
  }
  return lines.join("\n");
}

export function parseJSONL(jsonl: string): unknown[] {
  const events: unknown[] = [];
  const lines = jsonl.trim().split("\n");
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const ev = JSON.parse(line) as unknown;
      events.push(ev);
    } catch {
      // skip malformed lines
    }
  }
  return events;
}
