const DEFAULT_HOST = "https://us.posthog.com";

const SNAPSHOT_REQUEST_TIMEOUT_MS = 90_000;
const SNAPSHOT_MAX_RETRIES = 2;
const SNAPSHOT_RETRY_DELAY_MS = 2000;

export type PostHogConfig = {
  apiKey: string;
  projectId: string;
  host?: string;
};

export function posthogBaseUrl(host?: string): string {
  const base = host?.trim() || "us.posthog.com";
  return base.startsWith("http") ? base : `https://${base}`;
}

async function fetchWithTimeoutAndRetry(
  url: string,
  init: RequestInit,
  options: { timeoutMs?: number; maxRetries?: number } = {}
): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? SNAPSHOT_REQUEST_TIMEOUT_MS;
  const maxRetries = options.maxRetries ?? SNAPSHOT_MAX_RETRIES;
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        ...init,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const is5xx = res.status >= 500 && res.status < 600;
      if (res.ok || (!is5xx && !res.ok)) {
        return res;
      }
      if (is5xx && attempt < maxRetries) {
        lastError = new Error(`PostHog API ${res.status}`);
        await new Promise((r) => setTimeout(r, SNAPSHOT_RETRY_DELAY_MS));
        continue;
      }
      return res;
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err instanceof Error ? err : new Error(String(err));
      const isAbort = (err as { name?: string })?.name === "AbortError";
      if ((isAbort || (lastError.message?.includes("504") ?? false)) && attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, SNAPSHOT_RETRY_DELAY_MS));
        continue;
      }
      throw lastError;
    }
  }
  throw lastError ?? new Error("PostHog request failed");
}

export async function posthogListRecordings(
  config: PostHogConfig,
  options: { limit?: number; offset?: number } = {}
): Promise<{ results: Array<Record<string, unknown>>; count?: number }> {
  const base = posthogBaseUrl(config.host);
  const { limit = 10, offset = 0 } = options;
  const url = `${base}/api/projects/${config.projectId}/session_recordings/?limit=${limit}&offset=${offset}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PostHog API error ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as { results?: Array<Record<string, unknown>>; count?: number };
  return {
    results: data.results ?? [],
    count: data.count,
  };
}

export type SnapshotSource = {
  source: string;
  blob_key?: string;
  start_timestamp?: string;
  end_timestamp?: string;
};

export async function posthogSnapshotSources(
  config: PostHogConfig,
  sessionId: string
): Promise<SnapshotSource[]> {
  const base = posthogBaseUrl(config.host);
  const url = `${base}/api/environments/${config.projectId}/session_recordings/${sessionId}/snapshots?blob_v2=true`;
  const res = await fetchWithTimeoutAndRetry(
    url,
    {
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
    },
    { timeoutMs: SNAPSHOT_REQUEST_TIMEOUT_MS }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PostHog snapshot API error ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as { sources?: SnapshotSource[] };
  return data.sources ?? [];
}

export async function posthogSnapshotBlob(
  config: PostHogConfig,
  sessionId: string,
  startBlobKey: string,
  endBlobKey?: string
): Promise<string> {
  const base = posthogBaseUrl(config.host);
  const end = endBlobKey ?? startBlobKey;
  const url = `${base}/api/environments/${config.projectId}/session_recordings/${sessionId}/snapshots?source=blob_v2&start_blob_key=${encodeURIComponent(startBlobKey)}&end_blob_key=${encodeURIComponent(end)}`;
  const res = await fetchWithTimeoutAndRetry(
    url,
    {
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
      },
    },
    { timeoutMs: SNAPSHOT_REQUEST_TIMEOUT_MS }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PostHog blob API error ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.text();
}
