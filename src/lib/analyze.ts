import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export type AnalysisItem = {
  type: "bug" | "feature";
  title: string;
  description: string;
  severity?: string;
  timestampSeconds: number;
  suggestedFeatureReason?: string;
};

const SYSTEM_PROMPT = `You analyze session recording summaries to find UX bugs and suggest features.
Output valid JSON only, no markdown. Use this exact shape:
{"items":[{"type":"bug"|"feature","title":"short title","description":"what happened and why it's a bug or feature idea","severity":"critical|high|medium|low (for bugs)","timestampSeconds":0,"suggestedFeatureReason":"(only for type feature) why this feature would help"}]}
- For bugs: infer from evidence (e.g. console errors, long duration with few clicks = possible stuck UI). Use severity "critical" for blocking issues (e.g. modal never loads, form rejects valid input).
- You will receive a Session summary and one or more "Context around [time]s" blocks. Each block lists events (clicks, inputs, console logs, DOM mutations) in order with timestamps like "45.2s: ...". Use the exact timestamps (in seconds) from these lines to set timestampSeconds for when the bug is visible. For console errors, use the timestamp of the log/error line. Never use 0 when a specific time is given in the context.
- When only a Timeline is provided (lines like "Ns: event_type") without Context blocks, use those N values in seconds for timestampSeconds. If no Timeline and no Context, use 0.
- For features: only suggest if the session strongly implies a need. Use timestampSeconds 0 if no specific moment.
- If nothing clearly wrong or no feature suggested, return {"items":[]}.`;

export async function analyzeSessionStory(
  sessionStory: string,
  recordingId: string
): Promise<AnalysisItem[]> {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Recording ID: ${recordingId}\n\nSession summary:\n${sessionStory}`,
      },
    ],
    response_format: { type: "json_object" },
  });
  const raw = completion.choices[0]?.message?.content?.trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as { items?: AnalysisItem[] };
    const items = Array.isArray(parsed.items) ? parsed.items : [];
    return items
      .filter(
        (i) =>
          i &&
          typeof i.title === "string" &&
          typeof i.description === "string" &&
          typeof i.timestampSeconds === "number"
      )
      .map((i) => ({
        type: i.type === "feature" ? "feature" : "bug",
        title: String(i.title).slice(0, 300),
        description: String(i.description).slice(0, 2000),
        severity: i.severity ?? "medium",
        timestampSeconds: Math.max(0, Number(i.timestampSeconds)),
        suggestedFeatureReason: i.suggestedFeatureReason,
      }));
  } catch {
    return [];
  }
}
