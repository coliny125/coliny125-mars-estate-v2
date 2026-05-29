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

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 5000,
    messages: [
      {
        role: "user",
        content: `You are building a knowledge graph for Mars Estate, a Napa Valley winery. Extract all meaningful entities and relationships from the documents below.

## Knowledge base
${kbContext}

## Recent activity
${activityContext || "None"}

Extract:
- NODES: Every significant person, project, organization, and strategic topic. For each, note where they appear.
- EDGES: Relationships between nodes — who works where, who's involved in what project, what projects depend on each other, what topics are connected.

Node types: "person", "project", "org", "topic"
Edge relation types: "works_at", "involved_in", "depends_on", "related_to", "owns", "mentions", "competes_with"

Edge weight 1–5: how strong/frequent the relationship is (5 = core relationship, 1 = passing mention).

Return ONLY valid JSON:
{
  "nodes": [
    {
      "id": "kebab-case-unique-id",
      "type": "person|project|org|topic",
      "label": "Display Name",
      "description": "One sentence about this entity",
      "email": "email if person and known, else omit",
      "sources": ["slug or briefing/todos"],
      "mention_count": <integer>
    }
  ],
  "edges": [
    {
      "id": "source-id--relation--target-id",
      "source": "node-id",
      "target": "node-id",
      "relation": "works_at|involved_in|depends_on|related_to|owns|mentions|competes_with",
      "weight": <1-5>
    }
  ]
}

Be thorough — include all named people from contacts, all named projects, all organizations, and all major strategic themes as topic nodes.`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const text = textBlock?.type === "text" ? textBlock.text : "";

  // Find the outermost JSON object — try full match first, then truncation recovery
  let extracted: { nodes: Omit<GraphNode, "last_seen">[]; edges: Omit<GraphEdge, "last_active">[] };
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON object found in graph builder response");
  try {
    extracted = JSON.parse(match[0]);
  } catch {
    // Response was likely cut off — try to salvage by closing the JSON manually
    const partial = match[0];
    // Find how many nodes we got and return them without edges
    const nodesMatch = partial.match(/"nodes"\s*:\s*(\[[\s\S]*?\])/);
    if (nodesMatch) {
      try {
        extracted = { nodes: JSON.parse(nodesMatch[1]), edges: [] };
      } catch {
        throw new Error("Graph builder response could not be parsed. Try again.");
      }
    } else {
      throw new Error("Graph builder response malformed. Try again.");
    }
  }

  const now = new Date().toISOString();

  const graph: GraphData = {
    nodes: (extracted.nodes ?? []).map((n: Omit<GraphNode, "last_seen">) => ({ ...n, last_seen: now })),
    edges: (extracted.edges ?? []).map((e: Omit<GraphEdge, "last_active">) => ({ ...e, last_active: now })),
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
