/**
 * Shared types for the multi-step session analysis pipeline.
 */

export type RRWebEvent = {
  type?: number;
  data?: unknown;
  timestamp?: number;
  [key: string]: unknown;
};

export type CriticalMoment = {
  timestampMs: number;
  kind: string;
  reason?: string;
  eventIndex?: number;
};

export type EnrichedContext = {
  momentTimestampMs: number;
  kind: string;
  contextText: string;
};

export type SessionMetadata = {
  durationSeconds: number;
  click_count?: number;
  keypress_count?: number;
  console_error_count?: number;
  console_warn_count?: number;
};

/** Priority for dedupe: higher = keep this reason when merging moments within 5s */
export const MOMENT_PRIORITY: Record<string, number> = {
  console_error: 4,
  console_log: 3,
  input_before_error: 3,
  long_pause: 2,
  repeated_clicks: 1,
  session_start: 0,
  session_end: 0,
};
