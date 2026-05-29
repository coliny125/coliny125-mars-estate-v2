/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { relativeTime } from "@/lib/date";
import type { GraphData, GraphNode, GraphEdge, NodeDetail } from "@/lib/graph";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full text-parchment-500 text-sm">
      Loading graph…
    </div>
  ),
});

type Overlay = "none" | "heat" | "stale" | "dropped";

const NODE_COLORS: Record<string, string> = {
  person: "rgb(176 141 87)",   // brass
  project: "rgb(122 34 34)",   // oxblood
  org: "rgb(138 125 99)",      // parchment-500
  topic: "rgb(80 100 140)",    // slate blue
};

const TYPE_LABELS: Record<string, string> = {
  person: "Person",
  project: "Project",
  org: "Organization",
  topic: "Topic",
};

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

export default function GraphPageClient() {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);
  const [buildPhase, setBuildPhase] = useState("");
  const [buildError, setBuildError] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<Overlay>("none");
  const [filter, setFilter] = useState<string>("all");
  const [selectedNode, setSelectedNode] = useState<NodeDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const searchParams = useSearchParams();
  const deepLinkNode = searchParams.get("node");

  useEffect(() => {
    fetch("/api/graph")
      .then((r) => r.json())
      .then((d) => {
        if (d.nodes?.length) setGraphData(d);
      })
      .finally(() => setLoading(false));
  }, []);

  // Deep link: /graph?node=<id> opens that entity's 360° drawer once data is ready.
  useEffect(() => {
    if (deepLinkNode && graphData?.nodes.some((n) => n.id === deepLinkNode)) {
      openNode(deepLinkNode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkNode, graphData]);

  async function buildGraph() {
    setBuilding(true);
    setBuildError(null);
    try {
      // Phase 1: nodes (≤60s)
      setBuildPhase("Extracting entities…");
      const r1 = await fetch("/api/graph/build", { method: "POST" });
      if (!r1.ok) {
        const d = await r1.json().catch(() => ({}));
        throw new Error(d.error ?? `Node build error ${r1.status}`);
      }
      // Phase 2: edges (≤60s)
      setBuildPhase("Mapping relationships…");
      const r2 = await fetch("/api/graph/edges", { method: "POST" });
      if (!r2.ok) {
        const d = await r2.json().catch(() => ({}));
        throw new Error(d.error ?? `Edge build error ${r2.status}`);
      }
      const r3 = await fetch("/api/graph");
      setGraphData(await r3.json());
    } catch (e) {
      setBuildError(e instanceof Error ? e.message : "Build failed");
    } finally {
      setBuilding(false);
      setBuildPhase("");
    }
  }

  async function openNode(nodeId: string) {
    setDetailLoading(true);
    setDrawerOpen(true);
    try {
      const r = await fetch(`/api/graph/node/${nodeId}`);
      if (r.ok) {
        const d = await r.json();
        setSelectedNode(d.node);
      }
    } finally {
      setDetailLoading(false);
    }
  }

  const now = Date.now();

  const displayData = useMemo(() => {
    if (!graphData) return { nodes: [], links: [] };

    let nodes = graphData.nodes;

    // Type filter
    if (filter !== "all") {
      nodes = nodes.filter((n) => n.type === filter);
    }

    const nodeIds = new Set(nodes.map((n) => n.id));
    const links = graphData.edges
      .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
      .map((e) => ({
        ...e,
        source: e.source,
        target: e.target,
      }));

    return { nodes, links };
  }, [graphData, filter]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getNodeColor = useCallback(
    (node: any) => {
      const n = node as GraphNode;
      if (overlay === "heat") {
        const heat = Math.min((node.mention_count ?? 1) / 10, 1);
        const r = Math.round(176 * heat + 80 * (1 - heat));
        const g = Math.round(141 * heat + 100 * (1 - heat));
        const b = Math.round(87 * heat + 140 * (1 - heat));
        return `rgb(${r} ${g} ${b})`;
      }
      if (overlay === "stale") {
        const age = now - new Date(node.last_seen).getTime();
        return age > THIRTY_DAYS_MS ? "rgb(80 80 80)" : NODE_COLORS[node.type] ?? "rgb(138 125 99)";
      }
      if (overlay === "dropped") {
        // dropped = project nodes with no recent activity
        if (node.type === "project") {
          const age = now - new Date(node.last_seen).getTime();
          if (age > FOURTEEN_DAYS_MS) return "rgb(180 40 40)";
        }
      }
      return NODE_COLORS[n.type] ?? "rgb(138 125 99)";
    },
    [overlay, now]
  );

  // Node radius in graph units. Scales with degree under the heat overlay.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getNodeRadius = useCallback(
    (node: any) => {
      const n = node as GraphNode;
      const base = 5 + Math.min((n.mention_count ?? 0) * 0.7, 9);
      return overlay === "heat" ? base + 1 : base;
    },
    [overlay]
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getLinkColor = useCallback(
    (edge: any) => {
      const e = edge as GraphEdge;
      if (overlay === "stale") {
        const age = now - new Date(e.last_active).getTime();
        return age > THIRTY_DAYS_MS ? "rgba(120,120,120,0.35)" : "rgba(176,141,87,0.55)";
      }
      return "rgba(176,141,87,0.55)";
    },
    [overlay, now]
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getLinkWidth = useCallback(
    (edge: any) => Math.max(1, ((edge as GraphEdge).weight ?? 2) * 0.7),
    []
  );

  if (loading) {
    return (
      <div className="h-screen bg-[#0e0b0a] flex items-center justify-center">
        <span className="text-parchment-500 text-sm">Loading…</span>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#0e0b0a] flex flex-col overflow-hidden">
      {/* Header */}
      <header className="border-b hairline shrink-0 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="eyebrow hover:text-parchment-200 transition-colors">
            ← Dashboard
          </Link>
          <span className="text-parchment-500/40">|</span>
          <span className="display-serif text-lg text-parchment-200">Knowledge Graph</span>
          {graphData && (
            <span className="eyebrow text-parchment-500/60">
              {graphData.nodes.length} nodes · {graphData.edges.length} edges ·{" "}
              {graphData.built_at ? relativeTime(graphData.built_at) : "—"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          {buildError && (
            <span className="text-xs text-oxblood-400">{buildError}</span>
          )}
          {building && (
            <span className="text-xs text-parchment-500 animate-pulse">
              {buildPhase || "Building…"} (~2 min total)
            </span>
          )}
          <button
            type="button"
            onClick={buildGraph}
            disabled={building}
            className="text-[11px] tracking-eyebrow uppercase text-brass-400 hover:text-brass-400/80 disabled:opacity-40 transition-colors"
          >
            {building ? "Building…" : graphData ? "Rebuild" : "Build graph"}
          </button>
        </div>
      </header>

      {!graphData ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <p className="text-parchment-400 text-sm">
            No graph yet. Click <strong className="text-parchment-100">Build graph</strong> to extract
            entities from your knowledge base, briefing, and todos.
          </p>
          <p className="text-parchment-500/60 text-xs">
            Takes up to ~2 minutes — extracts ~100 entities and their relationships.
          </p>
        </div>
      ) : (
        <div className="flex-1 flex min-h-0 relative">
          {/* Controls sidebar */}
          <div className="w-48 border-r hairline shrink-0 flex flex-col gap-6 px-4 py-5 overflow-y-auto">
            <div>
              <div className="eyebrow mb-3">Overlay</div>
              <div className="flex flex-col gap-1.5">
                {(["none", "heat", "stale", "dropped"] as Overlay[]).map((o) => (
                  <button
                    key={o}
                    type="button"
                    onClick={() => setOverlay(o)}
                    className={`text-left text-xs px-2.5 py-1.5 rounded-sm transition-colors ${
                      overlay === o
                        ? "bg-brass-500/20 text-brass-400 border hairline-strong"
                        : "text-parchment-400 hover:text-parchment-100"
                    }`}
                  >
                    {o === "none" && "Default"}
                    {o === "heat" && "Topic heat"}
                    {o === "stale" && "Stale (>30d)"}
                    {o === "dropped" && "Dropped balls"}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="eyebrow mb-3">Filter type</div>
              <div className="flex flex-col gap-1.5">
                {["all", "person", "project", "org", "topic"].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setFilter(t)}
                    className={`text-left text-xs px-2.5 py-1.5 rounded-sm transition-colors ${
                      filter === t
                        ? "bg-brass-500/20 text-brass-400 border hairline-strong"
                        : "text-parchment-400 hover:text-parchment-100"
                    }`}
                  >
                    {t === "all" ? "All types" : TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="eyebrow mb-2">Legend</div>
              <div className="flex flex-col gap-1.5">
                {Object.entries(NODE_COLORS).map(([type, color]) => (
                  <div key={type} className="flex items-center gap-2">
                    <span
                      className="inline-block h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-[10px] tracking-eyebrow uppercase text-parchment-500">
                      {TYPE_LABELS[type]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Graph canvas */}
          <div className="flex-1 min-w-0 relative">
            <ForceGraph2D
              graphData={displayData}
              nodeId="id"
              nodeLabel=""
              linkColor={getLinkColor}
              linkWidth={getLinkWidth}
              linkLabel="relation"
              linkDirectionalParticles={0}
              backgroundColor="#0e0b0a"
              cooldownTicks={120}
              nodeRelSize={1}
              enableNodeDrag={true}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onNodeClick={(node: any) => openNode((node as GraphNode).id)}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              nodeCanvasObject={(node: any, ctx, globalScale) => {
                const n = node as GraphNode & { x: number; y: number };
                const r = getNodeRadius(n);
                const color = getNodeColor(n);

                // node circle with subtle ring
                ctx.beginPath();
                ctx.arc(n.x, n.y, r, 0, 2 * Math.PI);
                ctx.fillStyle = color;
                ctx.fill();
                ctx.lineWidth = 1 / globalScale;
                ctx.strokeStyle = "rgba(14,11,10,0.8)";
                ctx.stroke();

                // labels show once zoomed past a threshold
                if (globalScale >= 1.2) {
                  const fontSize = Math.max(10 / globalScale, 3.5);
                  ctx.font = `${fontSize}px ui-sans-serif, sans-serif`;
                  ctx.fillStyle = "rgba(244,238,226,0.9)";
                  ctx.textAlign = "center";
                  ctx.textBaseline = "top";
                  ctx.fillText(n.label, n.x, n.y + r + 1.5);
                }
              }}
              // Hit-area paint — REQUIRED for click/drag/hover with a custom
              // nodeCanvasObject. Without this, pointer events never land on nodes.
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              nodePointerAreaPaint={(node: any, color, ctx) => {
                const n = node as GraphNode & { x: number; y: number };
                const r = getNodeRadius(n);
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(n.x, n.y, r + 2, 0, 2 * Math.PI);
                ctx.fill();
              }}
            />
            <p className="absolute bottom-3 left-0 right-0 text-center text-[10px] tracking-eyebrow uppercase text-parchment-500/40 pointer-events-none">
              Click a node for 360° view · Drag nodes to rearrange · Scroll to zoom
            </p>
          </div>

          {/* 360° detail drawer */}
          {drawerOpen && (
            <div className="w-80 border-l hairline shrink-0 flex flex-col overflow-hidden bg-ink-700/40">
              <div className="px-5 py-4 border-b hairline flex items-center justify-between">
                <span className="eyebrow">360° View</span>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="text-parchment-500 hover:text-parchment-100 text-lg leading-none"
                >
                  ×
                </button>
              </div>

              {detailLoading ? (
                <div className="flex-1 flex items-center justify-center">
                  <span className="text-parchment-500 text-sm animate-pulse">Loading…</span>
                </div>
              ) : selectedNode ? (
                <div className="flex-1 overflow-y-auto panel-scroll px-5 py-5 space-y-5">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="inline-block h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: NODE_COLORS[selectedNode.type] }}
                      />
                      <span className="eyebrow">{TYPE_LABELS[selectedNode.type]}</span>
                    </div>
                    <h2 className="display-serif text-xl text-parchment-100">
                      {selectedNode.label}
                    </h2>
                    {selectedNode.email && (
                      <a
                        href={`mailto:${selectedNode.email}`}
                        className="text-xs text-brass-400 hover:underline mt-0.5 block"
                      >
                        {selectedNode.email}
                      </a>
                    )}
                    {selectedNode.description && (
                      <p className="text-sm text-parchment-400 mt-2 leading-snug">
                        {selectedNode.description}
                      </p>
                    )}
                  </div>

                  <div className="border-t hairline pt-4">
                    <div className="eyebrow mb-2">Activity</div>
                    <div className="text-xs text-parchment-400 space-y-1">
                      <div>Mentions: <span className="text-parchment-200">{selectedNode.mention_count}</span></div>
                      <div>Last seen: <span className="text-parchment-200">{relativeTime(selectedNode.last_seen)}</span></div>
                    </div>
                  </div>

                  {selectedNode.sources.length > 0 && (
                    <div className="border-t hairline pt-4">
                      <div className="eyebrow mb-2">Sources</div>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedNode.sources.map((s, i) => (
                          <span
                            key={i}
                            className="text-[10px] tracking-eyebrow uppercase border hairline rounded-sm px-1.5 py-0.5 text-parchment-500"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedNode.connected_node_ids.length > 0 && (
                    <div className="border-t hairline pt-4">
                      <div className="eyebrow mb-2">
                        Connected ({selectedNode.connected_node_ids.length})
                      </div>
                      <div className="space-y-1.5">
                        {selectedNode.connected_node_ids.map((id) => {
                          const n = graphData.nodes.find((x) => x.id === id);
                          if (!n) return null;
                          return (
                            <button
                              key={id}
                              type="button"
                              onClick={() => openNode(id)}
                              className="flex items-center gap-2 w-full text-left hover:text-parchment-100 transition-colors group"
                            >
                              <span
                                className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
                                style={{ backgroundColor: NODE_COLORS[n.type] }}
                              />
                              <span className="text-xs text-parchment-400 group-hover:text-parchment-100 truncate">
                                {n.label}
                              </span>
                              <span className="eyebrow opacity-50 shrink-0">{n.type}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
