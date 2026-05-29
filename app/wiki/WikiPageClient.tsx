"use client";

import { useEffect, useMemo, useState, Fragment } from "react";
import Link from "next/link";
import { relativeTime } from "@/lib/date";
import type { WikiData, WikiEntry } from "@/lib/wiki";
import type { NodeType } from "@/lib/graph";

const TYPE_COLORS: Record<NodeType, string> = {
  person: "rgb(176 141 87)",
  project: "rgb(122 34 34)",
  org: "rgb(138 125 99)",
  topic: "rgb(80 100 140)",
};
const TYPE_LABELS: Record<NodeType, string> = {
  person: "Person",
  project: "Project",
  org: "Organization",
  topic: "Topic",
};

export default function WikiPageClient() {
  const [wiki, setWiki] = useState<WikiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | NodeType>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/wiki")
      .then((r) => r.json())
      .then((d: WikiData) => {
        setWiki(d);
        if (d.entries?.length) setSelectedId(d.entries[0].id);
      })
      .finally(() => setLoading(false));
  }, []);

  async function rebuild() {
    setBuilding(true);
    setError(null);
    try {
      const r = await fetch("/api/wiki/build", { method: "POST" });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error ?? `Error ${r.status}`);
      }
      const r2 = await fetch("/api/wiki");
      setWiki(await r2.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Rebuild failed");
    } finally {
      setBuilding(false);
    }
  }

  const entries = wiki?.entries ?? [];
  const byId = useMemo(() => new Map(entries.map((e) => [e.id, e])), [entries]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (typeFilter !== "all" && e.type !== typeFilter) return false;
      if (!q) return true;
      return (
        e.label.toLowerCase().includes(q) ||
        e.summary.toLowerCase().includes(q) ||
        e.sections.some((s) => s.body.toLowerCase().includes(q))
      );
    });
  }, [entries, query, typeFilter]);

  const selected: WikiEntry | undefined = selectedId ? byId.get(selectedId) : undefined;

  // Group a selected entry's relations by phrasing for readable sections.
  const groupedRelations = useMemo(() => {
    if (!selected) return [];
    const groups = new Map<string, typeof selected.related>();
    for (const r of selected.related) {
      const list = groups.get(r.phrasing) ?? [];
      list.push(r);
      groups.set(r.phrasing, list);
    }
    return Array.from(groups.entries());
  }, [selected]);

  // For inline backlinks: a single regex of all entity labels (longest first
  // so multi-word names win), plus a label→id lookup.
  const { linkRegex, labelToId } = useMemo(() => {
    const labelToId = new Map<string, string>();
    const labels = entries
      .map((e) => e.label)
      .filter((l) => l.length >= 4) // skip tiny labels that cause noise
      .sort((a, b) => b.length - a.length);
    for (const e of entries) labelToId.set(e.label.toLowerCase(), e.id);
    if (labels.length === 0) return { linkRegex: null as RegExp | null, labelToId };
    const escaped = labels.map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const linkRegex = new RegExp(`\\b(${escaped.join("|")})\\b`, "gi");
    return { linkRegex, labelToId };
  }, [entries]);

  // Render text with entity labels turned into clickable links (skips self).
  function LinkedText({ text, selfId }: { text: string; selfId: string }) {
    if (!linkRegex) return <>{text}</>;
    const out: React.ReactNode[] = [];
    let last = 0;
    linkRegex.lastIndex = 0;
    let m: RegExpExecArray | null;
    let key = 0;
    while ((m = linkRegex.exec(text)) !== null) {
      const matchId = labelToId.get(m[0].toLowerCase());
      if (matchId && matchId !== selfId) {
        if (m.index > last) out.push(<Fragment key={key++}>{text.slice(last, m.index)}</Fragment>);
        const id = matchId;
        out.push(
          <button
            key={key++}
            type="button"
            onClick={() => setSelectedId(id)}
            className="text-brass-400 hover:text-brass-300 hover:underline"
          >
            {m[0]}
          </button>
        );
        last = m.index + m[0].length;
      }
    }
    if (last < text.length) out.push(<Fragment key={key++}>{text.slice(last)}</Fragment>);
    return <>{out}</>;
  }

  return (
    <div className="h-screen bg-[#0e0b0a] flex flex-col overflow-hidden">
      <header className="border-b hairline shrink-0 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4 min-w-0">
          <Link href="/" className="eyebrow hover:text-parchment-200 transition-colors">
            ← Dashboard
          </Link>
          <span className="text-parchment-500/40">|</span>
          <span className="display-serif text-lg text-parchment-200">Knowledge Wiki</span>
          {wiki?.generated_at && (
            <span className="eyebrow text-parchment-500/60">
              {entries.length} entries · {relativeTime(wiki.generated_at)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          {error && <span className="text-xs text-oxblood-400">{error}</span>}
          <Link href="/graph" className="text-[11px] tracking-eyebrow uppercase text-parchment-400 hover:text-parchment-100 transition-colors">
            View graph →
          </Link>
          <button
            type="button"
            onClick={rebuild}
            disabled={building}
            className="text-[11px] tracking-eyebrow uppercase text-brass-400 hover:text-brass-400/80 disabled:opacity-40 transition-colors"
          >
            {building ? "Rebuilding…" : "Rebuild"}
          </button>
        </div>
      </header>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-parchment-500 text-sm">
          Loading…
        </div>
      ) : entries.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <p className="text-parchment-400 text-sm">
            No wiki yet. Build the knowledge graph first, then click{" "}
            <strong className="text-parchment-100">Rebuild</strong>.
          </p>
          <Link href="/graph" className="text-brass-400 text-xs hover:underline">
            Go to graph →
          </Link>
        </div>
      ) : (
        <div className="flex-1 flex min-h-0">
          {/* List */}
          <div className="w-72 border-r hairline shrink-0 flex flex-col min-h-0">
            <div className="px-4 py-3 border-b hairline space-y-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search entries…"
                className="w-full bg-ink-700 hairline border rounded-sm px-3 py-1.5 text-sm text-parchment-100 placeholder:text-parchment-500 focus:outline-none focus:border-brass-500"
              />
              <div className="flex flex-wrap gap-1">
                {(["all", "person", "project", "org", "topic"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTypeFilter(t)}
                    className={`text-[10px] tracking-eyebrow uppercase px-2 py-1 rounded-sm transition-colors ${
                      typeFilter === t
                        ? "bg-brass-500/20 text-brass-400 border hairline-strong"
                        : "text-parchment-500 hover:text-parchment-200"
                    }`}
                  >
                    {t === "all" ? "All" : TYPE_LABELS[t as NodeType]}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto panel-scroll">
              {filtered.length === 0 ? (
                <p className="px-4 py-3 text-sm text-parchment-500 italic">No matches.</p>
              ) : (
                <ul>
                  {filtered.map((e) => (
                    <li key={e.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(e.id)}
                        className={`w-full text-left px-4 py-2.5 border-l-2 transition-colors ${
                          e.id === selectedId
                            ? "border-brass-500 bg-ink-700/60"
                            : "border-transparent hover:bg-ink-700/40"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: TYPE_COLORS[e.type] }}
                          />
                          <span className="text-sm text-parchment-200 truncate">{e.label}</span>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Detail */}
          <div className="flex-1 min-w-0 overflow-y-auto panel-scroll">
            {selected ? (
              <div className="max-w-2xl mx-auto px-8 py-8">
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: TYPE_COLORS[selected.type] }}
                  />
                  <span className="eyebrow">{TYPE_LABELS[selected.type]}</span>
                  {selected.mention_count > 0 && (
                    <span className="eyebrow opacity-50">· {selected.mention_count} connections</span>
                  )}
                </div>

                <h1 className="display-serif text-3xl text-parchment-100 mb-1">{selected.label}</h1>
                {selected.email && (
                  <a href={`mailto:${selected.email}`} className="text-sm text-brass-400 hover:underline">
                    {selected.email}
                  </a>
                )}

                <p className="text-base text-parchment-200 leading-relaxed mt-4 border-l-2 border-brass-500/30 pl-4">
                  <LinkedText text={selected.summary} selfId={selected.id} />
                </p>

                {selected.sections
                  .filter((s) => s.heading.toLowerCase() !== "overview" || s.body !== selected.summary)
                  .map((s, i) => (
                    <div key={i} className="mt-6">
                      <div className="eyebrow mb-1.5">{s.heading}</div>
                      <p className="text-sm text-parchment-300 leading-relaxed whitespace-pre-line">
                        <LinkedText text={s.body} selfId={selected.id} />
                      </p>
                    </div>
                  ))}

                {groupedRelations.length > 0 && (
                  <div className="mt-8">
                    <div className="eyebrow mb-3">Related</div>
                    <div className="space-y-3">
                      {groupedRelations.map(([phrasing, rels]) => (
                        <div key={phrasing}>
                          <div className="text-[11px] tracking-eyebrow uppercase text-parchment-500 mb-1.5">
                            {phrasing}
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {rels.map((r) => (
                              <button
                                key={r.id + r.phrasing}
                                type="button"
                                onClick={() => setSelectedId(r.id)}
                                className="flex items-center gap-1.5 text-xs border hairline rounded-sm px-2 py-1 text-parchment-300 hover:text-parchment-100 hover:bg-ink-700 transition-colors"
                              >
                                <span
                                  className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
                                  style={{ backgroundColor: TYPE_COLORS[r.type] }}
                                />
                                {r.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-8 pt-4 border-t hairline">
                  <Link
                    href={`/graph?node=${encodeURIComponent(selected.id)}`}
                    className="text-[11px] tracking-eyebrow uppercase text-brass-400 hover:text-brass-400/80 transition-colors"
                  >
                    View this entity in the graph →
                  </Link>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-parchment-500 text-sm">
                Select an entry.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
