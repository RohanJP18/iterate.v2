type Metadata = {
  click_count?: number;
  keypress_count?: number;
  console_error_count?: number;
  console_warn_count?: number;
  [key: string]: unknown;
};

export function buildSessionStory(recording: {
  durationSeconds: number;
  metadata: Metadata | null;
  startedAt: Date;
}): string {
  const meta = (recording.metadata ?? {}) as Metadata;
  const mins = Math.floor(recording.durationSeconds / 60);
  const secs = recording.durationSeconds % 60;
  const durationStr =
    mins > 0 ? `${mins} min ${secs} s` : `${recording.durationSeconds} s`;
  const clicks = meta.click_count ?? 0;
  const keypresses = meta.keypress_count ?? 0;
  const errors = meta.console_error_count ?? 0;
  const warns = meta.console_warn_count ?? 0;

  const lines: string[] = [
    `Session recording: duration ${durationStr}, started ${recording.startedAt.toISOString()}.`,
    `Activity: ${clicks} clicks, ${keypresses} keypresses.`,
  ];
  if (errors > 0) lines.push(`Console errors: ${errors}.`);
  if (warns > 0) lines.push(`Console warnings: ${warns}.`);
  if (errors === 0 && clicks === 0 && keypresses === 0)
    lines.push("No recorded clicks, keypresses, or console errors (metadata only).");
  return lines.join(" ");
}

export function buildSessionStoryWithTimeline(
  recording: {
    durationSeconds: number;
    metadata: Metadata | null;
    startedAt: Date;
  },
  snapshotTimeline: string
): string {
  const metaStory = buildSessionStory(recording);
  return `${metaStory}\n\nTimeline:\n${snapshotTimeline}`;
}
