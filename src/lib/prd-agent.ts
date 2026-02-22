import OpenAI from "openai";
import type { PRDContent } from "./prd-schema";
import { ensurePRDContent } from "./prd-schema";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const PRD_JSON_MARKER = "```json";
const PRD_JSON_MARKER_END = "```";

const SYSTEM_PROMPT = `You are a product requirements document (PRD) author. You help refine and expand a structured PRD based on conversation.

You receive:
1. The current PRD as JSON (overview, goals, userStories, apiContracts, dataModel, nonGoals, openQuestions, implementationNotes).
2. The conversation history in this PRD chat.
3. The user's latest message.

Your tasks:
- Respond in natural language to the user (friendly, concise).
- If the user asks to add, change, or remove something in the PRD, output the COMPLETE updated PRD JSON in a fenced code block so the system can parse it. Use this exact format:
\`\`\`json
{ ... full PRD object ... }
\`\`\`

Rules for the PRD JSON:
- overview: string (1-2 paragraphs)
- goals: string[] (each item one goal)
- userStories: array of { id: string, title: string, description: string, acceptanceCriteria: string[] }
- apiContracts: array of { method: string, path: string, description: string, requestBody?: string, responseBody?: string }
- dataModel: string (description or schema snippet)
- nonGoals: string[]
- openQuestions: string[]
- implementationNotes: string (optional)

Only output the JSON block when the user's message clearly asks to update the PRD. If they're just asking a question or clarifying, respond in text only without a JSON block.`;

export type PRDAgentParams = {
  userMessage: string;
  conversationHistory: { role: string; content: string }[];
  currentPRDContent: PRDContent;
};

export type PRDAgentResponse = {
  assistantMessage: string;
  updatedPRDContent: PRDContent | null;
};

function extractPRDJson(text: string): object | null {
  const start = text.indexOf(PRD_JSON_MARKER);
  if (start === -1) return null;
  const from = start + PRD_JSON_MARKER.length;
  const end = text.indexOf(PRD_JSON_MARKER_END, from);
  if (end === -1) return null;
  const raw = text.slice(from, end).trim();
  try {
    return JSON.parse(raw) as object;
  } catch {
    return null;
  }
}

export async function generatePRDResponse(params: PRDAgentParams): Promise<PRDAgentResponse> {
  const { userMessage, conversationHistory, currentPRDContent } = params;

  const userContent = [
    "## Current PRD (JSON)",
    JSON.stringify(currentPRDContent, null, 2),
    "",
    "## Conversation so far",
    ...conversationHistory.map((m) => `[${m.role}]: ${m.content}`),
    "",
    "## User message",
    userMessage,
  ].join("\n");

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ],
  });

  const text = completion.choices[0]?.message?.content?.trim() ?? "";
  const parsed = extractPRDJson(text);
  const updatedPRDContent = parsed ? ensurePRDContent(parsed) : null;

  return {
    assistantMessage: text,
    updatedPRDContent,
  };
}
