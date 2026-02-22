/**
 * Structured PRD content schema. Stored in PRDDraft.content (JSON).
 * Designed for CLI/codegen consumption.
 */
export type PRDUserStory = {
  id: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
};

export type PRDApiContract = {
  method: string;
  path: string;
  description: string;
  requestBody?: string;
  responseBody?: string;
};

export type PRDContent = {
  overview: string;
  goals: string[];
  userStories: PRDUserStory[];
  apiContracts?: PRDApiContract[];
  dataModel?: string;
  nonGoals: string[];
  openQuestions: string[];
  implementationNotes?: string;
};

export function getDefaultPRDContent(seedOverview?: string): PRDContent {
  return {
    overview: seedOverview ?? "",
    goals: [],
    userStories: [],
    apiContracts: [],
    dataModel: "",
    nonGoals: [],
    openQuestions: [],
    implementationNotes: "",
  };
}

export function ensurePRDContent(raw: unknown): PRDContent {
  if (raw !== null && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    return {
      overview: typeof o.overview === "string" ? o.overview : "",
      goals: Array.isArray(o.goals) ? o.goals.filter((g): g is string => typeof g === "string") : [],
      userStories: Array.isArray(o.userStories)
        ? o.userStories
            .filter((s): s is Record<string, unknown> => s !== null && typeof s === "object")
            .map((s) => ({
              id: typeof s.id === "string" ? s.id : `us-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              title: typeof s.title === "string" ? s.title : "",
              description: typeof s.description === "string" ? s.description : "",
              acceptanceCriteria: Array.isArray(s.acceptanceCriteria)
                ? (s.acceptanceCriteria as unknown[]).filter((c): c is string => typeof c === "string")
                : [],
            }))
        : [],
      apiContracts: Array.isArray(o.apiContracts)
        ? (o.apiContracts as PRDApiContract[]).filter(
            (c) => c && typeof c.method === "string" && typeof c.path === "string" && typeof c.description === "string"
          )
        : [],
      dataModel: typeof o.dataModel === "string" ? o.dataModel : "",
      nonGoals: Array.isArray(o.nonGoals) ? (o.nonGoals as unknown[]).filter((g): g is string => typeof g === "string") : [],
      openQuestions: Array.isArray(o.openQuestions) ? (o.openQuestions as unknown[]).filter((q): q is string => typeof q === "string") : [],
      implementationNotes: typeof o.implementationNotes === "string" ? o.implementationNotes : "",
    };
  }
  return getDefaultPRDContent();
}
