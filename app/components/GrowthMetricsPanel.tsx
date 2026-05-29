"use client";

import { useEffect, useState } from "react";
import type { Goal, GoalStatus } from "@/app/api/goals/route";

const STATUS_CONFIG: Record<GoalStatus, { dot: string; label: string }> = {
  on_track: { dot: "bg-brass-500", label: "On Track" },
  at_risk:  { dot: "bg-oxblood-500", label: "At Risk" },
  completed:{ dot: "bg-brass-500/40", label: "Done" },
  blocked:  { dot: "bg-parchment-500/40", label: "Blocked" },
};

const STATUS_OPTIONS: GoalStatus[] = ["on_track", "at_risk", "completed", "blocked"];

export default function GrowthMetricsPanel() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/goals")
      .then((r) => r.json())
      .then((d) => setGoals(d.goals ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function updateStatus(id: string, status: GoalStatus) {
    setGoals((prev) =>
      prev.map((g) => (g.id === id ? { ...g, status } : g))
    );
    await fetch(`/api/goals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  }

  async function updateNotes(id: string, notes: string) {
    setGoals((prev) =>
      prev.map((g) => (g.id === id ? { ...g, notes } : g))
    );
    await fetch(`/api/goals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    setEditing(null);
  }

  const counts = goals.reduce(
    (acc, g) => ({ ...acc, [g.status]: (acc[g.status] ?? 0) + 1 }),
    {} as Record<string, number>
  );

  const subLabel = loading
    ? "Loading…"
    : `${counts.completed ?? 0} done · ${counts.at_risk ?? 0} at risk · ${counts.blocked ?? 0} blocked`;

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
      </div>

      <div className="px-6 py-5 max-h-[32rem] overflow-y-auto panel-scroll">
        <ul className="space-y-3">
          {goals.map((goal) => {
            const cfg = STATUS_CONFIG[goal.status];
            const isEditingThis = editing === goal.id;
            return (
              <li key={goal.id} className="group border hairline rounded-sm px-4 py-3 bg-ink-700/30">
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-1.5 inline-block h-1.5 w-1.5 rounded-full shrink-0 ${cfg.dot}`}
                    aria-hidden
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-sm font-medium text-parchment-100 leading-snug">
                        {goal.title}
                      </span>
                      {goal.target && (
                        <span className="eyebrow opacity-60">{goal.target}</span>
                      )}
                    </div>

                    {goal.notes && !isEditingThis && (
                      <p className="text-xs text-parchment-400 leading-snug mt-0.5">
                        {goal.notes}
                      </p>
                    )}

                    {isEditingThis && (
                      <NoteEditor
                        initial={goal.notes ?? ""}
                        onSave={(notes) => updateNotes(goal.id, notes)}
                        onCancel={() => setEditing(null)}
                      />
                    )}
                  </div>

                  <div className="shrink-0 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <select
                      value={goal.status}
                      onChange={(e) => updateStatus(goal.id, e.target.value as GoalStatus)}
                      className="bg-ink-700 hairline border rounded-sm px-1.5 py-0.5 text-[10px] tracking-eyebrow uppercase text-parchment-300 focus:outline-none focus:border-brass-500 cursor-pointer"
                      aria-label="Goal status"
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_CONFIG[s].label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setEditing(isEditingThis ? null : goal.id)}
                      className="text-[10px] tracking-eyebrow uppercase text-parchment-500/50 hover:text-parchment-200 transition-colors"
                    >
                      Notes
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function NoteEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial: string;
  onSave: (v: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <div className="mt-2">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={2}
        className="w-full bg-transparent text-xs text-parchment-100 placeholder:text-parchment-500 border hairline rounded-sm px-2 py-1.5 focus:outline-none focus:border-brass-500 resize-none"
        autoFocus
      />
      <div className="flex gap-2 mt-1.5">
        <button
          type="button"
          onClick={() => onSave(value)}
          className="text-[10px] tracking-eyebrow uppercase border hairline rounded-sm px-2 py-1 text-parchment-100 hover:bg-ink-700 transition-colors"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-[10px] tracking-eyebrow uppercase text-parchment-500 hover:text-parchment-200 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
