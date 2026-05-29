"use client";

import { useEffect, useState } from "react";
import { relativeTime } from "@/lib/date";
import type { PinnedGoal } from "@/lib/pinned-goals";
import type { GoalAssessment, GoalsAssessment } from "@/lib/goals";

export default function GrowthMetricsPanel() {
  const [goals, setGoals] = useState<PinnedGoal[]>([]);
  const [assessment, setAssessment] = useState<GoalsAssessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [assessing, setAssessing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [draft, setDraft] = useState<PinnedGoal[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/goals/pinned").then((r) => r.json()),
      fetch("/api/goals/assessment").then((r) => r.json()),
    ]).then(([pinnedData, assessmentData]) => {
      setGoals(pinnedData.goals ?? []);
      setAssessment(assessmentData.assessment ?? null);
    }).finally(() => setLoading(false));
  }, []);

  async function runAssessment() {
    setAssessing(true);
    try {
      const r = await fetch("/api/goals/assessment", { method: "POST" });
      if (r.ok) {
        const data = await r.json();
        setAssessment(data.assessment);
      }
    } finally {
      setAssessing(false);
    }
  }

  function startEdit() {
    setDraft(goals.map((g) => ({ ...g })));
    setSaveError(null);
    setEditing(true);
  }

  async function saveEdit() {
    setSaving(true);
    setSaveError(null);
    try {
      const r = await fetch("/api/goals/pinned", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goals: draft }),
      });
      if (!r.ok) throw new Error(`Server error ${r.status}`);
      const data = await r.json();
      setGoals(data.goals ?? draft);
      setEditing(false);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const assessMap = new Map<string, GoalAssessment>(
    (assessment?.assessments ?? []).map((a) => [a.goal_id, a])
  );

  const subLabel = assessment
    ? `Assessed ${relativeTime(assessment.generated_at)}`
    : loading
    ? "Loading…"
    : "Not yet assessed — updates daily";

  return (
    <section className="panel-surface rounded-sm shadow-panel transition-colors">
      <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b hairline">
        <div className="min-w-0">
          <div className="eyebrow">Panel 04</div>
          <h2 className="display-serif text-2xl text-parchment-100 leading-tight mt-1 truncate">
            Long-term Goals
          </h2>
          <div className="text-xs text-parchment-500 mt-2">{subLabel}</div>
        </div>
        <div className="shrink-0 flex items-center gap-3">
          {!editing && (
            <button
              type="button"
              onClick={runAssessment}
              disabled={assessing}
              className="text-[11px] tracking-eyebrow uppercase text-brass-400 hover:text-brass-400/80 disabled:opacity-40 transition-colors"
            >
              {assessing ? "Assessing…" : "Assess now"}
            </button>
          )}
          <button
            type="button"
            onClick={editing ? () => setEditing(false) : startEdit}
            className="text-[11px] tracking-eyebrow uppercase text-parchment-400 hover:text-parchment-100 transition-colors"
          >
            {editing ? "Cancel" : "Edit goals"}
          </button>
        </div>
      </div>

      <div className="px-6 py-5 max-h-[32rem] overflow-y-auto panel-scroll">
        {editing ? (
          <div className="space-y-4">
            <p className="text-xs text-parchment-500">
              Set your 3 long-term goals. The AI assesses daily progress toward each.
            </p>
            {draft.map((g, i) => (
              <div key={g.id} className="space-y-1.5">
                <div className="eyebrow">Goal {i + 1}</div>
                <input
                  type="text"
                  value={g.title}
                  onChange={(e) =>
                    setDraft((prev) =>
                      prev.map((p, j) => j === i ? { ...p, title: e.target.value } : p)
                    )
                  }
                  placeholder="Goal title…"
                  className="w-full bg-ink-700 hairline border rounded-sm px-3 py-2 text-sm text-parchment-100 placeholder:text-parchment-500 focus:outline-none focus:border-brass-500"
                />
                <input
                  type="text"
                  value={g.horizon}
                  onChange={(e) =>
                    setDraft((prev) =>
                      prev.map((p, j) => j === i ? { ...p, horizon: e.target.value } : p)
                    )
                  }
                  placeholder="Horizon (e.g. 2027, Q4 2026)…"
                  className="w-full bg-ink-700 hairline border rounded-sm px-3 py-2 text-sm text-parchment-400 placeholder:text-parchment-500 focus:outline-none focus:border-brass-500"
                />
              </div>
            ))}
            {saveError && (
              <p className="text-xs text-oxblood-400">{saveError}</p>
            )}
            <button
              type="button"
              onClick={saveEdit}
              disabled={saving}
              className="text-[11px] tracking-eyebrow uppercase border hairline-strong rounded-sm px-3 py-1.5 text-parchment-100 hover:bg-ink-700 disabled:opacity-40 transition-colors"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        ) : (
          <ul className="space-y-5">
            {goals.map((goal) => {
              const a = assessMap.get(goal.id);
              return (
                <li key={goal.id} className="border-l-2 border-brass-500/25 pl-4">
                  <div className="mb-2">
                    <span className="text-sm font-medium text-parchment-100">
                      {goal.title}
                    </span>
                    {goal.horizon && (
                      <span className="ml-2 eyebrow opacity-50">{goal.horizon}</span>
                    )}
                  </div>

                  {!a && (
                    <p className="text-xs text-parchment-500/60 italic">
                      Daily assessment pending…
                    </p>
                  )}

                  {a && (
                    <div className="space-y-2">
                      {a.toward.length > 0 && (
                        <div>
                          <div className="eyebrow text-brass-500/80 mb-1">Moving toward</div>
                          <ul className="space-y-0.5">
                            {a.toward.map((b, i) => (
                              <li key={i} className="flex gap-2 text-xs text-parchment-300 leading-snug">
                                <span className="text-brass-500 shrink-0 mt-0.5">↑</span>
                                {b}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {a.away.length > 0 && (
                        <div>
                          <div className="eyebrow text-oxblood-500/80 mb-1">Risks / gaps</div>
                          <ul className="space-y-0.5">
                            {a.away.map((b, i) => (
                              <li key={i} className="flex gap-2 text-xs text-parchment-400 leading-snug">
                                <span className="text-oxblood-400 shrink-0 mt-0.5">↓</span>
                                {b}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
