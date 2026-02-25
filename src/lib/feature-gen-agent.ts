import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `You are a product feature analyst. Your job is to generate evidence-based feature outlines using:

1. PostHog data (issues, session recordings, counts) as primary evidence. Cite specific issue IDs, session counts, and metrics.
2. Customer interview transcripts (from uploaded PDFs/audio) when provided. Quote or paraphrase with attribution.
3. The user's question or request.

Output format for feature suggestions:
- **Feature name**: Short, clear title.
- **Problem statement**: What’s wrong or missing, backed by PostHog evidence (e.g. "Issue #xyz affects 15 sessions: users click submit but the form doesn’t respond").
- **Proposed solution**: What to build or change.
- **Why this matters**: Impact, affected users, severity.
- **Implementation notes**: Brief technical or UX considerations.

Rules:
- Be specific: reference issue IDs, session counts, error rates from the context.
- If the data doesn’t support a strong recommendation, say so and suggest what data would help.
- When customer quotes are provided, use them to support the problem statement or solution.
- Use markdown for structure (headers, lists, bold). Use the product accent color sparingly for links or citations if needed.`;

export type FeatureGenParams = {
  userMessage: string;
  postHogContext: string;
  fileTranscripts: string;
};

export async function generateFeatureResponse(params: FeatureGenParams): Promise<string> {
  const { userMessage, postHogContext, fileTranscripts } = params;

  const userContent = [
    "## PostHog / product context",
    postHogContext,
    fileTranscripts ? "\n## Customer interview / uploaded file transcripts\n" + fileTranscripts : "",
    "\n## User request\n",
    userMessage,
  ]
    .filter(Boolean)
    .join("\n");

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ],
  });

  const text = completion.choices[0]?.message?.content?.trim();
  return text ?? "";
}
