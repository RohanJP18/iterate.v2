const DEFAULT_HOST = "https://us.posthog.com";

export type PostHogConfig = {
  apiKey: string;
  projectId: string;
  host?: string;
};

export function posthogBaseUrl(host?: string): string {
  const base = host?.trim() || "us.posthog.com";
  return base.startsWith("http") ? base : `https://${base}`;
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
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
  });
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
  blobKey: string
): Promise<string> {
  const base = posthogBaseUrl(config.host);
  const url = `${base}/api/environments/${config.projectId}/session_recordings/${sessionId}/snapshots?source=blob_v2&blob_key=${encodeURIComponent(blobKey)}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PostHog blob API error ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.text();
}
