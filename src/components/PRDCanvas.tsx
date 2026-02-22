"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { PRDContent, PRDUserStory, PRDApiContract } from "@/lib/prd-schema";

type PRDCanvasProps = {
  content: PRDContent;
  onChange: (content: PRDContent) => void;
  onSave?: (content: PRDContent) => void | Promise<void>;
  draftId: string | null;
};

export function PRDCanvas({ content, onChange, onSave, draftId }: PRDCanvasProps) {
  const [local, setLocal] = useState<PRDContent>(content);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLocal(content);
  }, [content]);

  const persist = useCallback(
    async (next: PRDContent) => {
      if (draftId && onSave) {
        setSaving(true);
        try {
          await onSave(next);
        } finally {
          setSaving(false);
        }
      }
    },
    [draftId, onSave]
  );

  const debouncedSave = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleChange = useCallback(
    (next: PRDContent) => {
      setLocal(next);
      onChange(next);
      if (draftId && onSave) {
        if (debouncedSave.current) clearTimeout(debouncedSave.current);
        debouncedSave.current = setTimeout(() => {
          persist(next);
          debouncedSave.current = null;
        }, 500);
      }
    },
    [onChange, draftId, onSave, persist]
  );

  const update = useCallback(
    (patch: Partial<PRDContent>) => {
      handleChange({ ...local, ...patch });
    },
    [local, handleChange]
  );

  const addGoal = () => update({ goals: [...local.goals, ""] });
  const setGoal = (i: number, v: string) => {
    const g = [...local.goals];
    g[i] = v;
    update({ goals: g });
  };
  const removeGoal = (i: number) => update({ goals: local.goals.filter((_, j) => j !== i) });

  const addUserStory = () =>
    update({
      userStories: [
        ...local.userStories,
        {
          id: `us-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          title: "",
          description: "",
          acceptanceCriteria: [],
        },
      ],
    });
  const updateUserStory = (i: number, patch: Partial<PRDUserStory>) => {
    const u = [...local.userStories];
    u[i] = { ...u[i], ...patch };
    update({ userStories: u });
  };
  const removeUserStory = (i: number) =>
    update({ userStories: local.userStories.filter((_, j) => j !== i) });

  const addAc = (storyIndex: number) => {
    const u = [...local.userStories];
    u[storyIndex] = {
      ...u[storyIndex],
      acceptanceCriteria: [...u[storyIndex].acceptanceCriteria, ""],
    };
    update({ userStories: u });
  };
  const setAc = (storyIndex: number, acIndex: number, v: string) => {
    const u = [...local.userStories];
    const ac = [...u[storyIndex].acceptanceCriteria];
    ac[acIndex] = v;
    u[storyIndex] = { ...u[storyIndex], acceptanceCriteria: ac };
    update({ userStories: u });
  };
  const removeAc = (storyIndex: number, acIndex: number) => {
    const u = [...local.userStories];
    u[storyIndex] = {
      ...u[storyIndex],
      acceptanceCriteria: u[storyIndex].acceptanceCriteria.filter((_, j) => j !== acIndex),
    };
    update({ userStories: u });
  };

  const apiContracts = local.apiContracts ?? [];
  const addApiContract = () =>
    update({
      apiContracts: [...apiContracts, { method: "GET", path: "", description: "" }],
    });
  const updateApiContract = (i: number, patch: Partial<PRDApiContract>) => {
    const a = [...apiContracts];
    a[i] = { ...a[i], ...patch };
    update({ apiContracts: a });
  };
  const removeApiContract = (i: number) =>
    update({ apiContracts: apiContracts.filter((_, j) => j !== i) });

  const addNonGoal = () => update({ nonGoals: [...local.nonGoals, ""] });
  const setNonGoal = (i: number, v: string) => {
    const n = [...local.nonGoals];
    n[i] = v;
    update({ nonGoals: n });
  };
  const removeNonGoal = (i: number) => update({ nonGoals: local.nonGoals.filter((_, j) => j !== i) });

  const addOpenQuestion = () => update({ openQuestions: [...local.openQuestions, ""] });
  const setOpenQuestion = (i: number, v: string) => {
    const q = [...local.openQuestions];
    q[i] = v;
    update({ openQuestions: q });
  };
  const removeOpenQuestion = (i: number) =>
    update({ openQuestions: local.openQuestions.filter((_, j) => j !== i) });

  return (
    <div className="flex flex-col h-full overflow-auto p-4 space-y-6">
      {saving && (
        <p className="text-xs text-gray-500">Saving...</p>
      )}
      <section>
        <label className="block text-sm font-medium text-charcoal mb-1">Overview</label>
        <textarea
          value={local.overview}
          onChange={(e) => update({ overview: e.target.value })}
          rows={4}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-charcoal"
        />
      </section>
      <section>
        <div className="flex items-center justify-between mb-1">
          <label className="text-sm font-medium text-charcoal">Goals</label>
          <button
            type="button"
            onClick={addGoal}
            className="text-xs text-[#0ea5e9] hover:underline"
          >
            + Add
          </button>
        </div>
        <ul className="space-y-2">
          {local.goals.map((g, i) => (
            <li key={i} className="flex gap-2">
              <input
                value={g}
                onChange={(e) => setGoal(i, e.target.value)}
                className="flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm"
              />
              <button type="button" onClick={() => removeGoal(i)} className="text-gray-400 hover:text-red-600">
                ×
              </button>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <div className="flex items-center justify-between mb-1">
          <label className="text-sm font-medium text-charcoal">User Stories</label>
          <button
            type="button"
            onClick={addUserStory}
            className="text-xs text-[#0ea5e9] hover:underline"
          >
            + Add
          </button>
        </div>
        <div className="space-y-4">
          {local.userStories.map((us, i) => (
            <div key={us.id} className="rounded-lg border border-gray-200 p-3">
              <div className="flex justify-between items-start gap-2 mb-2">
                <input
                  value={us.title}
                  onChange={(e) => updateUserStory(i, { title: e.target.value })}
                  placeholder="Title"
                  className="flex-1 font-medium rounded border border-gray-300 px-2 py-1 text-sm"
                />
                <button type="button" onClick={() => removeUserStory(i)} className="text-gray-400 hover:text-red-600">
                  ×
                </button>
              </div>
              <textarea
                value={us.description}
                onChange={(e) => updateUserStory(i, { description: e.target.value })}
                placeholder="Description"
                rows={2}
                className="w-full rounded border border-gray-300 px-2 py-1 text-sm mb-2"
              />
              <div className="text-xs font-medium text-gray-500 mb-1">Acceptance criteria</div>
              {us.acceptanceCriteria.map((ac, j) => (
                <div key={j} className="flex gap-2 mb-1">
                  <input
                    value={ac}
                    onChange={(e) => setAc(i, j, e.target.value)}
                    className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
                  />
                  <button type="button" onClick={() => removeAc(i, j)} className="text-gray-400 hover:text-red-600">
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => addAc(i)}
                className="text-xs text-[#0ea5e9] hover:underline mt-1"
              >
                + Criterion
              </button>
            </div>
          ))}
        </div>
      </section>
      <section>
        <div className="flex items-center justify-between mb-1">
          <label className="text-sm font-medium text-charcoal">API Contracts</label>
          <button
            type="button"
            onClick={addApiContract}
            className="text-xs text-[#0ea5e9] hover:underline"
          >
            + Add
          </button>
        </div>
        <div className="space-y-2">
          {apiContracts.map((c, i) => (
            <div key={i} className="flex flex-wrap gap-2 items-center rounded border border-gray-200 p-2">
              <input
                value={c.method}
                onChange={(e) => updateApiContract(i, { method: e.target.value })}
                placeholder="GET"
                className="w-16 rounded border border-gray-300 px-2 py-1 text-sm"
              />
              <input
                value={c.path}
                onChange={(e) => updateApiContract(i, { path: e.target.value })}
                placeholder="/path"
                className="flex-1 min-w-[120px] rounded border border-gray-300 px-2 py-1 text-sm"
              />
              <input
                value={c.description}
                onChange={(e) => updateApiContract(i, { description: e.target.value })}
                placeholder="Description"
                className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
              />
              <button type="button" onClick={() => removeApiContract(i)} className="text-gray-400 hover:text-red-600">
                ×
              </button>
            </div>
          ))}
        </div>
      </section>
      <section>
        <label className="block text-sm font-medium text-charcoal mb-1">Data Model</label>
        <textarea
          value={local.dataModel ?? ""}
          onChange={(e) => update({ dataModel: e.target.value })}
          rows={3}
          placeholder="Schema or description"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-charcoal"
        />
      </section>
      <section>
        <div className="flex items-center justify-between mb-1">
          <label className="text-sm font-medium text-charcoal">Non-Goals</label>
          <button
            type="button"
            onClick={addNonGoal}
            className="text-xs text-[#0ea5e9] hover:underline"
          >
            + Add
          </button>
        </div>
        <ul className="space-y-2">
          {local.nonGoals.map((n, i) => (
            <li key={i} className="flex gap-2">
              <input
                value={n}
                onChange={(e) => setNonGoal(i, e.target.value)}
                className="flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm"
              />
              <button type="button" onClick={() => removeNonGoal(i)} className="text-gray-400 hover:text-red-600">
                ×
              </button>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <div className="flex items-center justify-between mb-1">
          <label className="text-sm font-medium text-charcoal">Open Questions</label>
          <button
            type="button"
            onClick={addOpenQuestion}
            className="text-xs text-[#0ea5e9] hover:underline"
          >
            + Add
          </button>
        </div>
        <ul className="space-y-2">
          {local.openQuestions.map((q, i) => (
            <li key={i} className="flex gap-2">
              <input
                value={q}
                onChange={(e) => setOpenQuestion(i, e.target.value)}
                className="flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm"
              />
              <button type="button" onClick={() => removeOpenQuestion(i)} className="text-gray-400 hover:text-red-600">
                ×
              </button>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <label className="block text-sm font-medium text-charcoal mb-1">Implementation Notes</label>
        <textarea
          value={local.implementationNotes ?? ""}
          onChange={(e) => update({ implementationNotes: e.target.value })}
          rows={3}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-charcoal"
        />
      </section>
    </div>
  );
}
