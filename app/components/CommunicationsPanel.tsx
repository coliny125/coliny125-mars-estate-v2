"use client";

import { useEffect, useRef, useState } from "react";
import { relativeTime } from "@/lib/date";

interface BriefItem {
  id: string;
  kind: "decision" | "risk" | "opportunity" | "update";
  body: string;
  source_kind?: string;
  source_refs: { label: string; url?: string }[];
  handled: boolean;
}

interface Briefing {
  id: string;
  generated_at: string;
  summary?: string;
  thread_count?: number;
}

const KIND_STYLES: Record<string, { dot: string; label: string }> = {
  decision: { dot: "bg-brass-500", label: "Decision" },
  risk: { dot: "bg-oxblood-500", label: "Risk" },
  opportunity: { dot: "bg-brass-500/60", label: "Opportunity" },
  update: { dot: "bg-parchment-500/60", label: "Update" },
};

export default function CommunicationsPanel() {
  const [items, setItems] = useState<BriefItem[]>([]);
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHandled, setShowHandled] = useState(false);
  const [gmailConnected, setGmailConnected] = useState<boolean | null>(null);
  const briefingIdRef = useRef<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/gmail/status")
      .then((r) => r.json())
      .then((d) => setGmailConnected(d.connected))
      .catch(() => setGmailConnected(false));
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load(opts: { includeHandled?: boolean } = {}) {
    setLoading(true);
    setError(null);
    try {
      const url = `/api/briefing${opts.includeHandled ? "?include_handled=1" : ""}`;
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) throw new Error(`Error ${r.status}`);
      const data = await r.json();
      setBriefing(data.briefing);
      setItems(data.items ?? []);
      briefingIdRef.current = data.briefing?.id ?? null;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  async function triggerSync() {
    setSyncing(true);
    setError(null);
    try {
      const r = await fetch("/api/briefing", { method: "POST" });
      if (!r.ok) throw new Error(`Error ${r.status}`);
      const data = await r.json();
      setBriefing(data.briefing);
      setItems(data.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  async function markHandled(id: string, handled: boolean) {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, handled } : item))
    );
    await fetch(`/api/briefing/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handled }),
    });
  }

  const visible = showHandled ? items : items.filter((i) => !i.handled);

  const subLabel = briefing
    ? `${relativeTime(briefing.generated_at)} · ${briefing.thread_count ?? 0} threads`
    : loading
    ? "Loading…"
    : "No briefing yet";

  return (
    <section className="panel-surface rounded-sm shadow-panel transition-colors">
      <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b hairline">
        <div className="min-w-0">
          <div className="eyebrow">Panel 01</div>
          <h2 className="display-serif text-2xl text-parchment-100 leading-tight mt-1 truncate">
            Communications
          </h2>
          <div className="text-xs text-parchment-500 mt-2">{subLabel}</div>
        </div>
        <div className="shrink-0 flex items-center gap-3">
          {gmailConnected === false && (
            <a
              href="/settings"
              className="text-[11px] tracking-eyebrow uppercase text-brass-400 hover:text-brass-400/80 transition-colors border border-brass-500/30 rounded-sm px-2 py-1"
            >
              Connect Gmail
            </a>
          )}
          {gmailConnected === true && (
            <span className="text-[10px] tracking-eyebrow uppercase text-brass-500/70">
              Gmail ✓
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              const next = !showHandled;
              setShowHandled(next);
              load({ includeHandled: next });
            }}
            className="text-[11px] tracking-eyebrow uppercase text-parchment-400 hover:text-parchment-100 transition-colors"
          >
            {showHandled ? "Hide handled" : "Show handled"}
          </button>
          <button
            type="button"
            onClick={triggerSync}
            disabled={syncing}
            className="text-[11px] tracking-eyebrow uppercase text-parchment-400 hover:text-parchment-100 disabled:opacity-40 transition-colors"
          >
            {syncing ? "Syncing…" : "Reload"}
          </button>
        </div>
      </div>
      <div className="px-6 py-5 max-h-[32rem] overflow-y-auto panel-scroll">
        {error && <p className="text-sm text-oxblood-400 mb-4">{error}</p>}

        {!loading && !briefing && !error && (
          <div className="text-sm text-parchment-500 italic space-y-3">
            <p>No briefing yet.</p>
            {gmailConnected === false ? (
              <p>
                <a href="/settings" className="text-brass-400 hover:underline">Connect Gmail in Settings</a>, then click{" "}
                <button
                  onClick={triggerSync}
                  className="text-brass-400 hover:underline"
                >
                  Reload
                </button>{" "}
                to generate your first briefing.
              </p>
            ) : (
              <p>
                Click{" "}
                <button
                  onClick={triggerSync}
                  className="text-brass-400 hover:underline"
                >
                  Reload
                </button>{" "}
                to pull from Gmail and generate today&apos;s brief.
              </p>
            )}
          </div>
        )}

        {!loading && briefing && visible.length === 0 && (
          <p className="text-sm text-parchment-500/70 italic">
            Everything handled.
          </p>
        )}

        {briefing?.summary && (
          <p className="text-xs text-parchment-500 italic mb-4 border-l-2 border-brass-500/30 pl-3">
            {briefing.summary}
          </p>
        )}

        <ul className="space-y-3">
          {visible.map((item) => {
            const style = KIND_STYLES[item.kind] ?? KIND_STYLES.update;
            return (
              <li key={item.id} className="group">
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-1.5 inline-block h-1.5 w-1.5 rounded-full shrink-0 ${style.dot}`}
                    aria-hidden
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="eyebrow">{style.label}</span>
                      {item.source_kind && (
                        <span className="eyebrow opacity-60">
                          · {item.source_kind}
                        </span>
                      )}
                    </div>
                    <p
                      className={`text-sm leading-snug ${
                        item.handled
                          ? "text-parchment-500 line-through"
                          : "text-parchment-100"
                      }`}
                    >
                      {item.body}
                    </p>
                    {item.source_refs.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {item.source_refs.map((ref, i) => (
                          <span
                            key={i}
                            className="text-[10px] tracking-eyebrow uppercase text-parchment-500 border hairline rounded-sm px-1.5 py-0.5"
                          >
                            {ref.label}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => markHandled(item.id, !item.handled)}
                    className="shrink-0 text-[10px] tracking-eyebrow uppercase text-parchment-500/50 hover:text-parchment-200 transition-colors opacity-0 group-hover:opacity-100 pt-0.5"
                  >
                    {item.handled ? "Unmark" : "Handle"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
