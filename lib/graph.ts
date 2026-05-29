import { kv } from "@vercel/kv";
import Anthropic from "@anthropic-ai/sdk";
import { getKBIndex, getKBDoc } from "@/lib/kb";

export type NodeType = "person" | "project" | "org" | "topic";
export type RelationType =
  | "works_at"
  | "involved_in"
  | "depends_on"
  | "mentions"
  | "owns"
  | "related_to"
  | "competes_with";

export interface GraphNode {
  id: string;
  type: NodeType;
  label: string;
  description?: string;
  email?: string;
  last_seen: string;
  sources: string[]; // KB slugs or "briefing", "todos", "goals"
  mention_count: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relation: RelationType;
  last_active: string;
  weight: number; // 1–5, higher = stronger relationship
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  built_at: string;
}

export interface NodeDetail extends GraphNode {
  appearances: { source: string; date: string; excerpt: string }[];
  connected_node_ids: string[];
}

const GRAPH_KEY = "graph:data";
const GRAPH_BUILT_KEY = "graph:built_at";

export async function getGraph(): Promise<GraphData | null> {
  const raw = await kv.get<string>(GRAPH_KEY);
  if (!raw) return null;
  return typeof raw === "string" ? JSON.parse(raw) : (raw as GraphData);
}

export async function saveGraph(data: GraphData): Promise<void> {
  await Promise.all([
    kv.set(GRAPH_KEY, JSON.stringify(data)),
    kv.set(GRAPH_BUILT_KEY, data.built_at),
  ]);
}

export async function getNodeDetail(
  nodeId: string,
  graph: GraphData
): Promise<NodeDetail | null> {
  const node = graph.nodes.find((n) => n.id === nodeId);
  if (!node) return null;

  const connectedEdges = graph.edges.filter(
    (e) => e.source === nodeId || e.target === nodeId
  );
  const connected_node_ids = [
    ...Array.from(new Set(
      connectedEdges.map((e) => (e.source === nodeId ? e.target : e.source))
    )),
  ];

  // Build appearance list from node's sources
  const appearances: { source: string; date: string; excerpt: string }[] =
    node.sources.map((s) => ({
      source: s,
      date: node.last_seen,
      excerpt: `Referenced in ${s}`,
    }));

  return { ...node, appearances, connected_node_ids };
}

export async function isGraphStale(maxAgeHours = 24): Promise<boolean> {
  const ts = await kv.get<string>(GRAPH_BUILT_KEY);
  if (!ts) return true;
  const age = (Date.now() - new Date(ts as string).getTime()) / 3_600_000;
  return age > maxAgeHours;
}

// ── Graph builder ─────────────────────────────────────────────────────────────

export async function buildGraph(
  userId: string,
  opts: { briefingItems?: string[]; openTodos?: string[] } = {}
): Promise<GraphData> {
  const apiKey = process.env.ANTHROPIC_API_KEY!;
  const client = new Anthropic({ apiKey });

  // Load all KB docs — cap each doc at 800 chars (entities appear early)
  // Use allSettled so a single KV failure doesn't abort the whole build
  const DOC_CHAR_CAP = 800;
  const index = await getKBIndex();
  const settled = await Promise.allSettled(
    index.map(async (entry) => {
      const doc = await getKBDoc(entry.slug);
      if (!doc) return null;
      const excerpt = doc.content.slice(0, DOC_CHAR_CAP);
      return `## ${doc.title} [${entry.section}]\n${excerpt}`;
    })
  );
  const rawDocs = settled
    .filter((r): r is PromiseFulfilledResult<string | null> => r.status === "fulfilled")
    .map((r) => r.value)
    .filter((v): v is string => v !== null);

  const kbContext = rawDocs.join("\n\n---\n\n");

  const activityContext = [
    opts.briefingItems?.length
      ? `Recent briefing items:\n${opts.briefingItems.join("\n")}`
      : "",
    opts.openTodos?.length
      ? `Open todos:\n${opts.openTodos.join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  type RawNode = { id: string; type: NodeType; label: string; desc?: string; email?: string };
  type RawEdge = { s: string; t: string; r: RelationType; w?: number };

  function parseJson<T>(text: string, key: "nodes" | "edges"): T[] {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return [];
    try {
      const parsed = JSON.parse(match[0]);
      return (parsed[key] ?? []) as T[];
    } catch {
      // Salvage the array alone if the object is truncated
      const arrMatch = match[0].match(new RegExp(`"${key}"\\s*:\\s*(\\[[\\s\\S]*\\])`));
      if (arrMatch) {
        // Trim to the last complete object in the array
        const trimmed = arrMatch[1].replace(/,\s*\{[^}]*$/, "") + (arrMatch[1].trimEnd().endsWith("]") ? "" : "]");
        try {
          return JSON.parse(trimmed) as T[];
        } catch {
          return [];
        }
      }
      return [];
    }
  }

  // ── Call 1: extract nodes ───────────────────────────────────────────────────
  const nodesResp = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 6000,
    messages: [
      {
        role: "user",
        content: `Extract knowledge-graph NODES for Mars Estate, a Napa Valley winery. Capture every significant person, project, organization, and strategic topic from the material below.

## Knowledge base
${kbContext}

## Recent activity
${activityContext || "None"}

Node types: person, project, org, topic

Return ONLY compact JSON. "desc" max 6 words. Omit "email" if unknown.
{"nodes":[{"id":"kebab-id","type":"person","label":"Display Name","desc":"short","email":"x@y.com"}]}

Be thorough — all named people from contacts, all projects, all orgs, all major strategic themes.`,
      },
    ],
  });
  const nodesText =
    nodesResp.content.find((b) => b.type === "text")?.type === "text"
      ? (nodesResp.content.find((b) => b.type === "text") as { text: string }).text
      : "";
  const rawNodes = parseJson<RawNode>(nodesText, "nodes");
  if (rawNodes.length === 0) {
    throw new Error("Graph builder returned no nodes — try Rebuild again.");
  }

  // ── Call 2: extract edges given the node list ────────────────────────────────
  const nodeList = rawNodes
    .map((n) => `${n.id} (${n.type}: ${n.label})`)
    .join("\n");

  const edgesResp = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 6000,
    messages: [
      {
        role: "user",
        content: `Given these Mars Estate entities, identify the relationships (edges) between them. Use the exact ids shown.

## Entities
${nodeList}

Relation types: works_at, involved_in, depends_on, related_to, owns, competes_with
Edge weight "w" 1-5 (5 = core relationship).

Return ONLY compact JSON:
{"edges":[{"s":"source-id","t":"target-id","r":"works_at","w":3}]}

Be thorough — connect each person to their org, each person to projects they touch, related projects and topics, and dependencies between projects.`,
      },
    ],
  });
  const edgesText =
    edgesResp.content.find((b) => b.type === "text")?.type === "text"
      ? (edgesResp.content.find((b) => b.type === "text") as { text: string }).text
      : "";
  const rawEdges = parseJson<RawEdge>(edgesText, "edges");

  const now = new Date().toISOString();

  // Degree (connection count) → "heat" metric
  const degree: Record<string, number> = {};
  for (const e of rawEdges) {
    degree[e.s] = (degree[e.s] ?? 0) + 1;
    degree[e.t] = (degree[e.t] ?? 0) + 1;
  }

  const validNodeIds = new Set(rawNodes.map((n) => n.id));

  const graph: GraphData = {
    nodes: rawNodes.map((n) => ({
      id: n.id,
      type: n.type,
      label: n.label,
      description: n.desc,
      email: n.email,
      last_seen: now,
      sources: [],
      mention_count: degree[n.id] ?? 0,
    })),
    edges: rawEdges
      .filter((e) => validNodeIds.has(e.s) && validNodeIds.has(e.t))
      .map((e) => ({
        id: `${e.s}--${e.r}--${e.t}`,
        source: e.s,
        target: e.t,
        relation: e.r,
        weight: e.w ?? 2,
        last_active: now,
      })),
    built_at: now,
  };

  await saveGraph(graph);
  return graph;
}

// ── Incremental update from enrichment ───────────────────────────────────────

export async function updateGraphFromEnrichment(contacts: {
  name: string;
  role: string;
  email?: string;
  context: string;
}[]): Promise<void> {
  const graph = await getGraph();
  if (!graph) return;

  const now = new Date().toISOString();
  let changed = false;

  for (const contact of contacts) {
    const id = contact.name.toLowerCase().replace(/\s+/g, "-");
    const existing = graph.nodes.find((n) => n.id === id);
    if (existing) {
      existing.last_seen = now;
      existing.mention_count = (existing.mention_count ?? 0) + 1;
      changed = true;
    } else {
      graph.nodes.push({
        id,
        type: "person",
        label: contact.name,
        description: `${contact.role} — ${contact.context}`,
        email: contact.email,
        last_seen: now,
        sources: ["briefing"],
        mention_count: 1,
      });
      changed = true;
    }
  }

  if (changed) {
    graph.built_at = now;
    await saveGraph(graph);
  }
}
