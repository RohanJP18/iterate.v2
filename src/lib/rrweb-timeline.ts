const MAX_EVENTS = 100;
const MAX_CHARS = 8000;

export type RRWebEvent = {
  type?: number;
  data?: unknown;
  timestamp?: number;
  [key: string]: unknown;
};

/**
 * Recursively normalize a serialized DOM node so rrweb's rebuild sees full keys (type, childNodes, attributes).
 * PostHog/compressors may use shortened keys (t, c, a).
 */
function normalizeSerializedNode(sn: unknown): unknown {
  if (sn === null || typeof sn !== "object") return sn;
  const n = sn as Record<string, unknown>;
  const type = n.type ?? n.t;
  const childNodesRaw = n.childNodes ?? n.c;
  const childNodes = Array.isArray(childNodesRaw)
    ? childNodesRaw.map((c) => normalizeSerializedNode(c)).filter((c) => c != null)
    : childNodesRaw;
  const attributes = n.attributes ?? n.a;
  const out: Record<string, unknown> = { ...n };
  if (type !== undefined) out.type = type;
  if (childNodes !== undefined) out.childNodes = childNodes;
  if (attributes !== undefined) out.attributes = attributes;
  return out;
}

/**
 * Normalize raw snapshot events (e.g. from PostHog) to a canonical RRWebEvent shape.
 * - PostHog blob_v2 JSONL can be [windowId, event] per line; we use the second element.
 * - Handles standard rrweb (type, timestamp, data) and shortened keys (t, ts, d).
 * - Tries multiple payload keys (data, d, payload, p) and node keys (node, n, snapshot, payload, root).
 * - Normalizes the node tree so rrweb's Replayer can rebuild.
 */
export function normalizeRRWebEvents(raw: unknown[]): RRWebEvent[] {
  const out: RRWebEvent[] = [];
  for (const ev of raw) {
    let o: Record<string, unknown>;
    if (Array.isArray(ev) && ev.length >= 2) {
      o = (ev[1] !== null && typeof ev[1] === "object" ? ev[1] : ev[0]) as Record<string, unknown>;
    } else if (ev !== null && typeof ev === "object") {
      o = ev as Record<string, unknown>;
    } else {
      continue;
    }
    const type = num(o.type ?? o.t);
    const timestamp = num(o.timestamp ?? o.ts);
    let data = o.data ?? o.d ?? o.payload ?? o.p;
    const eventType = type ?? 0;
    if (eventType === 2 && typeof data === "string") {
      const str = data as string;
      try {
        data = JSON.parse(str) as unknown;
      } catch {
        try {
          const decoded =
            typeof Buffer !== "undefined"
              ? Buffer.from(str, "base64").toString("utf-8")
              : atob(str);
          data = JSON.parse(decoded) as unknown;
        } catch {
          // leave data as string if both parse and base64+parse fail
        }
      }
    }
    if (data !== undefined && data !== null && typeof data === "object") {
      if (Array.isArray(data)) {
        if (eventType === 2 && data.length > 0 && data[0] !== null && typeof data[0] === "object") {
          data = {
            node: normalizeSerializedNode(data[0]),
            initialOffset: (data as unknown[])[1] ?? {},
          };
        }
      } else {
        const d = data as Record<string, unknown>;
        let rawNode =
          d.node ?? d.n ?? d.snapshot ?? d.payload ?? d.root;
        if (rawNode === undefined && eventType === 2 && (d.type !== undefined || d.t !== undefined || d.childNodes !== undefined || d.c !== undefined)) {
          rawNode = d;
        }
        const hasSource = d.source !== undefined || d.s !== undefined;
        const hasNode = rawNode !== undefined && rawNode !== null;
        data = {
          ...d,
          ...(hasSource && d.source === undefined && d.s !== undefined && { source: d.s }),
          ...(hasNode && { node: normalizeSerializedNode(rawNode) }),
        };
      }
    }
    out.push({
      ...o,
      type: type ?? 0,
      timestamp: timestamp ?? 0,
      data: data ?? o.data ?? o.d ?? o.payload ?? o.p,
    });
  }
  return out;
}

function num(v: unknown): number | undefined {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (!Number.isNaN(n)) return n;
  }
  return undefined;
}

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
  const firstTs = arr.length > 0 ? ((arr[0] as RRWebEvent).timestamp ?? 0) : 0;
  for (let i = 0; i < arr.length && i < MAX_EVENTS && totalChars < MAX_CHARS; i++) {
    const ev = arr[i] as RRWebEvent;
    const ts = ev.timestamp ?? 0;
    const sec = Math.max(0, Math.floor((ts - firstTs) / 1000));
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
