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

  // Robust extractor: scans for the named array, then collects every COMPLETE
  // {...} object via brace-counting. Survives truncation (stops at the last
  // whole object) and stray non-ASCII characters (sanitized first). This is the
  // critical fix — the edges response routinely truncates at max_tokens, and a
  // regex parser requiring a closing bracket would silently return [].
  function extractObjects<T>(text: string, key: "nodes" | "edges"): T[] {
    const clean = text.replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "");
    const keyIdx = clean.indexOf(`"${key}"`);
    if (keyIdx < 0) return [];
    const bracket = clean.indexOf("[", keyIdx);
    if (bracket < 0) return [];

    const objs: T[] = [];
    let depth = 0;
    let cur = "";
    let inObj = false;
    for (let i = bracket + 1; i < clean.length; i++) {
      const c = clean[i];
      if (c === "{") {
        if (depth === 0) {
          inObj = true;
          cur = "";
        }
        depth++;
        cur += c;
      } else if (c === "}") {
        depth--;
        cur += c;
        if (depth === 0 && inObj) {
          try {
            objs.push(JSON.parse(cur) as T);
          } catch {
            /* skip malformed object */
          }
          inObj = false;
        }
      } else if (inObj) {
        cur += c;
      } else if (c === "]" && depth === 0) {
        break; // end of the target array
      }
    }
    return objs;
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
  const rawNodes = extractObjects<RawNode>(nodesText, "nodes").filter(
    (n) => n && n.id && n.label
  );
  if (rawNodes.length === 0) {
    throw new Error("Graph builder returned no nodes — try Rebuild again.");
  }

  // ── Call 2: extract edges given the node list ────────────────────────────────
  // Pass bare ids (comma-separated) — verified to maximize exact-id reuse by the model.
  const nodeList = rawNodes.map((n) => n.id).join(", ");

  const edgesResp = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 6000,
    messages: [
      {
        role: "user",
        content: `These are the Mars Estate knowledge-graph entity ids. Identify the relationships between them. Edge "s" and "t" MUST be exact ids from this list — never invent new ids.

## Entity ids
${nodeList}

Relation types: works_at, involved_in, depends_on, related_to, owns, competes_with
Edge weight "w" 1-5 (5 = core relationship).

Return ONLY compact JSON:
{"edges":[{"s":"exact-id","t":"exact-id","r":"works_at","w":3}]}

Be thorough — connect each person to their org, each person to the projects they touch, related projects and topics, and dependencies between projects.`,
      },
    ],
  });
  const edgesText =
    edgesResp.content.find((b) => b.type === "text")?.type === "text"
      ? (edgesResp.content.find((b) => b.type === "text") as { text: string }).text
      : "";
  const rawEdges = extractObjects<RawEdge>(edgesText, "edges").filter(
    (e) => e && e.s && e.t
  );

  const now = new Date().toISOString();

  // ── Entity resolution (methodology step 5) ──────────────────────────────────
  // Resolve each edge endpoint to a real node id: exact match first, then a
  // normalized match (strip non-alphanumerics) so "heidi_barrett" → "heidi-barrett".
  const idSet = new Set(rawNodes.map((n) => n.id));
  const normMap = new Map<string, string>();
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  for (const n of rawNodes) normMap.set(norm(n.id), n.id);

  const resolve = (raw: string): string | null => {
    if (idSet.has(raw)) return raw;
    const byNorm = normMap.get(norm(raw));
    return byNorm ?? null;
  };

  // Dedupe, drop self-loops and unresolvable endpoints
  const seen = new Set<string>();
  const resolvedEdges: GraphEdge[] = [];
  for (const e of rawEdges) {
    const s = resolve(e.s);
    const t = resolve(e.t);
    if (!s || !t || s === t) continue;
    const key = `${s}|${t}|${e.r}`;
    if (seen.has(key)) continue;
    seen.add(key);
    resolvedEdges.push({
      id: `${s}--${e.r}--${t}`,
      source: s,
      target: t,
      relation: e.r,
      weight: e.w ?? 2,
      last_active: now,
    });
  }

  // Degree (connection count) → "heat" metric and node sizing
  const degree: Record<string, number> = {};
  for (const e of resolvedEdges) {
    degree[e.source] = (degree[e.source] ?? 0) + 1;
    degree[e.target] = (degree[e.target] ?? 0) + 1;
  }

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
    edges: resolvedEdges,
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
