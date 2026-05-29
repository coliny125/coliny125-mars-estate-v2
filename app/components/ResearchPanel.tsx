"use client";

import { useEffect, useRef, useState } from "react";
import { relativeTime } from "@/lib/date";
import ProgressBar from "./ProgressBar";

interface ResearchItem {
  id: string;
  topic: string;
  summary: string;
  bullets?: string[];
  source?: string;
  generated_at: string;
}

interface ResearchData {
  items: ResearchItem[];
  focus: string[];
  generated_at: string | null;
}

export default function ResearchPanel() {
  const [data, setData] = useState<ResearchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingFocus, setEditingFocus] = useState(false);
  const [focusText, setFocusText] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/research");
      if (!r.ok) throw new Error(`Error ${r.status}`);
      const d = await r.json();
      setData(d);
      setFocusText((d.focus ?? []).join("\n"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  async function runResearch() {
    setRunning(true);
    setError(null);
    abortRef.current = new AbortController();
    try {
      const r = await fetch("/api/research", {
        method: "POST",
        signal: abortRef.current.signal,
      });
      if (!r.ok) throw new Error(`Error ${r.status}`);
      const d = await r.json();
      setData(d);
    } catch (e) {
      if (e instanceof Error && e.name !== "AbortError") {
        setError(e.message);
      }
    } finally {
      setRunning(false);
    }
  }

  async function saveFocus() {
    const topics = focusText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    await fetch("/api/research/focus", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topics }),
    });
    setData((d) => (d ? { ...d, focus: topics } : d));
    setEditingFocus(false);
  }

  const subLabel = data?.generated_at
    ? `Last run ${relativeTime(data.generated_at)}`
    : loading
    ? "Loading…"
    : "No data yet";

  return (
    <section className="panel-surface rounded-sm shadow-panel transition-colors">
      <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b hairline">
        <div className="min-w-0">
          <div className="eyebrow">Panel 03</div>
          <h2 className="display-serif text-2xl text-parchment-100 leading-tight mt-1 truncate">
            Research &amp; News
          </h2>
          <div className="text-xs text-parchment-500 mt-2">{subLabel}</div>
        </div>
        <div className="shrink-0 flex items-center gap-3">
          <button
            type="button"
            disabled={running}
            onClick={runResearch}
            className="text-[11px] tracking-eyebrow uppercase text-brass-400 hover:text-brass-400/80 disabled:text-parchment-500/40 transition-colors"
            title="Run the research agent now against the current focus list"
          >
            {running ? "Running…" : "Research now"}
          </button>
          <button
            type="button"
            onClick={() => setEditingFocus((v) => !v)}
            className="text-[11px] tracking-eyebrow uppercase text-parchment-400 hover:text-parchment-100 transition-colors"
          >
            Edit focus
          </button>
          <button
            type="button"
            onClick={fetchData}
            className="text-[11px] tracking-eyebrow uppercase text-parchment-400 hover:text-parchment-100 transition-colors"
            aria-label="Refresh"
          >
            Reload
          </button>
        </div>
      </div>
      <ProgressBar active={running} durationMs={20000} />
      <div className="px-6 py-5 max-h-[32rem] overflow-y-auto panel-scroll">
        {editingFocus && (
          <div className="mb-6 border hairline rounded-sm p-4 bg-ink-700/40">
            <div className="eyebrow mb-2">Focus topics (one per line)</div>
            <textarea
              value={focusText}
              onChange={(e) => setFocusText(e.target.value)}
              rows={5}
              className="w-full bg-transparent text-sm text-parchment-100 placeholder:text-parchment-500 focus:outline-none resize-none"
              placeholder={"Howell Mountain AVA pricing\nNapa Valley harvest outlook\nDTC wine sales trends"}
            />
            <div className="flex gap-2 mt-3">
              <button
                type="button"
                onClick={saveFocus}
                className="text-[11px] tracking-eyebrow uppercase border hairline-strong rounded-sm px-3 py-1.5 text-parchment-100 hover:bg-ink-700 transition-colors"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditingFocus(false)}
                className="text-[11px] tracking-eyebrow uppercase text-parchment-500 hover:text-parchment-200 transition-colors px-2"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {error && (
          <p className="text-sm text-oxblood-400 mb-4">{error}</p>
        )}

        {!loading && !error && (!data || data.items.length === 0) && (
          <p className="text-sm text-parchment-500 italic">
            No research yet. Add focus topics and click &quot;Research now&quot; to run the
            agent.
          </p>
        )}

        <div className="space-y-6">
          {(data?.items ?? []).map((item) => (
            <div key={item.id} className="border-l-2 border-transparent hover:border-brass-500/40 pl-3 transition-colors">
              <div className="mb-1">
                <h3 className="text-sm font-medium text-parchment-100 leading-snug">
                  {item.topic}
                </h3>
                {item.source && (
                  <span className="eyebrow opacity-60">{item.source}</span>
                )}
              </div>
              <p className="text-sm text-parchment-300 leading-relaxed">
                {item.summary}
              </p>
              {item.bullets && item.bullets.length > 0 && (
                <ul className="mt-2 space-y-1 list-disc pl-4 marker:text-parchment-500">
                  {item.bullets.map((b, i) => (
                    <li key={i} className="text-xs text-parchment-400 leading-snug">
                      {b}
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-1.5 text-[10px] tracking-eyebrow uppercase text-parchment-500/60">
                {relativeTime(item.generated_at)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
