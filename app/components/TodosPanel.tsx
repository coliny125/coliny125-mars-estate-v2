"use client";

import { useEffect, useState } from "react";
import type { Priority, Todo } from "@/lib/storage";
import ProgressBar from "./ProgressBar";

const GROUPS: { priority: Priority; label: string; dot: string }[] = [
  { priority: "H", label: "High Priority — This Week", dot: "bg-oxblood-500" },
  { priority: "M", label: "Medium Priority — Next Two Weeks", dot: "bg-brass-500" },
  { priority: "L", label: "Ongoing", dot: "bg-parchment-500/60" },
];

export default function TodosPanel() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDone, setShowDone] = useState(false);
  const [newText, setNewText] = useState("");
  const [newPriority, setNewPriority] = useState<Priority>("M");
  const [submitting, setSubmitting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  async function fetchTodos() {
    const r = await fetch("/api/todos");
    if (r.ok) {
      const data = await r.json();
      setTodos(data.todos);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchTodos();
  }, []);

  async function addTodo(e: React.FormEvent) {
    e.preventDefault();
    if (!newText.trim()) return;
    setSubmitting(true);
    const r = await fetch("/api/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: newText.trim(), priority: newPriority }),
    });
    if (r.ok) {
      const data = await r.json();
      setTodos((prev) => [data.todo, ...prev]);
      setNewText("");
    }
    setSubmitting(false);
  }

  async function toggleDone(id: string, done: boolean) {
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done } : t))
    );
    await fetch(`/api/todos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done }),
    });
  }

  async function deleteTodo(id: string) {
    setTodos((prev) => prev.filter((t) => t.id !== id));
    await fetch(`/api/todos/${id}`, { method: "DELETE" });
  }

  async function generateTodos() {
    setGenerating(true);
    setGenerateError(null);
    try {
      const r = await fetch("/api/todos/generate", { method: "POST" });
      if (!r.ok) {
        const d = await r.json();
        throw new Error(d.error ?? `Error ${r.status}`);
      }
      const data = await r.json();
      setTodos((prev) => [...(data.todos ?? []), ...prev]);
    } catch (e) {
      setGenerateError(e instanceof Error ? e.message : "Failed to generate");
    } finally {
      setGenerating(false);
    }
  }

  const visible = showDone ? todos : todos.filter((t) => !t.done);

  const subLabel = generateError
    ? generateError
    : loading
    ? "Loading…"
    : `${todos.filter((t) => !t.done).length} open`;

  return (
    <section className="panel-surface rounded-sm shadow-panel transition-colors">
      <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b hairline">
        <div className="min-w-0">
          <div className="eyebrow">Panel 02</div>
          <h2 className="display-serif text-2xl text-parchment-100 leading-tight mt-1 truncate">
            Immediate To-dos
          </h2>
          <div className="text-xs text-parchment-500 mt-2">{subLabel}</div>
        </div>
        <div className="shrink-0 flex items-center gap-3">
          <button
            type="button"
            onClick={generateTodos}
            disabled={generating}
            className="text-[11px] tracking-eyebrow uppercase text-brass-400 hover:text-brass-400/80 disabled:opacity-40 transition-colors"
          >
            {generating ? "Generating…" : "Generate"}
          </button>
          <button
            type="button"
            onClick={() => setShowDone((s) => !s)}
            className="text-[11px] tracking-eyebrow uppercase text-parchment-400 hover:text-parchment-100 transition-colors"
          >
            {showDone ? "Hide done" : "Show done"}
          </button>
        </div>
      </div>
      <ProgressBar active={generating} durationMs={10000} />
      <div className="px-6 py-5 max-h-[32rem] overflow-y-auto panel-scroll">
        <form onSubmit={addTodo} className="flex items-stretch gap-2 mb-6">
          <select
            aria-label="Priority"
            value={newPriority}
            onChange={(e) => setNewPriority(e.target.value as Priority)}
            className="bg-ink-700 hairline border rounded-sm px-2 py-2 text-sm text-parchment-200 focus:outline-none focus:border-brass-500"
          >
            <option value="H">High</option>
            <option value="M" >Medium</option>
            <option value="L">Ongoing</option>
          </select>
          <input
            type="text"
            placeholder="Add a to-do — what needs doing?"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            className="flex-1 bg-ink-700 hairline border rounded-sm px-3 py-2 text-sm text-parchment-100 placeholder:text-parchment-500 focus:outline-none focus:border-brass-500"
          />
          <button
            type="submit"
            disabled={submitting || !newText.trim()}
            className="px-4 py-2 text-[11px] tracking-eyebrow uppercase border hairline-strong rounded-sm text-parchment-100 hover:bg-ink-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Add
          </button>
        </form>

        <div className="space-y-6">
          {GROUPS.map(({ priority, label, dot }) => {
            const group = visible.filter((t) => t.priority === priority);
            return (
              <div key={priority}>
                <div className="flex items-center gap-3 mb-2">
                  <span
                    className={`inline-block h-1.5 w-1.5 rounded-full ${dot}`}
                    aria-hidden
                  />
                  <span className="eyebrow">{label}</span>
                  <span className="text-xs text-parchment-500">
                    · {group.length}
                  </span>
                </div>
                {group.length === 0 ? (
                  <p className="text-sm text-parchment-500/70 italic pl-5">
                    Nothing here.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {group.map((todo) => (
                      <li
                        key={todo.id}
                        className="group flex items-start gap-3 pl-5"
                      >
                        <button
                          type="button"
                          onClick={() => toggleDone(todo.id, !todo.done)}
                          className={`mt-0.5 shrink-0 h-3.5 w-4 rounded-sm border hairline transition-colors ${
                            todo.done
                              ? "bg-parchment-500/40 border-parchment-500/50"
                              : "border-parchment-500/50 hover:border-brass-400"
                          }`}
                          aria-label={todo.done ? "Mark undone" : "Mark done"}
                        />
                        <span
                          className={`flex-1 text-sm leading-snug ${
                            todo.done
                              ? "text-parchment-500 line-through"
                              : "text-parchment-100"
                          }`}
                        >
                          {todo.text}
                        </span>
                        <button
                          type="button"
                          onClick={() => deleteTodo(todo.id)}
                          className="shrink-0 text-[10px] tracking-eyebrow uppercase text-parchment-500/40 hover:text-oxblood-400/80 transition-colors opacity-0 group-hover:opacity-100"
                          aria-label="Delete"
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
