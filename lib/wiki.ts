import { kv } from "@vercel/kv";
import { getGraph } from "@/lib/graph";
import type { NodeType, RelationType, GraphData } from "@/lib/graph";

// Human-readable phrasing for each relation, in both directions.
const RELATION_PHRASING: Record<RelationType, { out: string; in: string }> = {
  works_at: { out: "works at", in: "employs / includes" },
  involved_in: { out: "involved in", in: "involves" },
  depends_on: { out: "depends on", in: "is depended on by" },
  owns: { out: "owns", in: "owned by" },
  related_to: { out: "related to", in: "related to" },
  competes_with: { out: "competes with", in: "competes with" },
  mentions: { out: "mentions", in: "mentioned by" },
};

export interface WikiRelation {
  id: string;
  label: string;
  type: NodeType;
  phrasing: string; // e.g. "works at"
}

export interface WikiEntry {
  id: string;
  label: string;
  type: NodeType;
  definition: string;
  email?: string;
  related: WikiRelation[];
  mention_count: number;
}

export interface WikiData {
  entries: WikiEntry[];
  generated_at: string;
}

const WIKI_KEY = "wiki:data";

export async function getWiki(): Promise<WikiData | null> {
  const raw = await kv.get<string>(WIKI_KEY);
  if (!raw) return null;
  return typeof raw === "string" ? JSON.parse(raw) : (raw as WikiData);
}

export async function saveWiki(data: WikiData): Promise<void> {
  await kv.set(WIKI_KEY, JSON.stringify(data));
}

// Build wiki entries purely from the knowledge graph — no LLM calls, fits any
// plan/time limit. Each node becomes an entry; backlinks come from the edges.
export function deriveWikiFromGraph(graph: GraphData): WikiData {
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));

  const relatedByNode = new Map<string, WikiRelation[]>();
  const pushRel = (nodeId: string, otherId: string, phrasing: string) => {
    const other = nodeById.get(otherId);
    if (!other) return;
    const list = relatedByNode.get(nodeId) ?? [];
    if (list.some((r) => r.id === otherId && r.phrasing === phrasing)) return;
    list.push({ id: other.id, label: other.label, type: other.type, phrasing });
    relatedByNode.set(nodeId, list);
  };

  for (const e of graph.edges) {
    const phr = RELATION_PHRASING[e.relation] ?? { out: e.relation, in: e.relation };
    pushRel(e.source, e.target, phr.out);
    pushRel(e.target, e.source, phr.in);
  }

  const entries: WikiEntry[] = graph.nodes
    .map((n) => ({
      id: n.id,
      label: n.label,
      type: n.type,
      definition: n.description?.trim() || `${n.label} — ${n.type} in the Mars Estate operations graph.`,
      email: n.email,
      related: (relatedByNode.get(n.id) ?? []).sort((a, b) =>
        a.label.localeCompare(b.label)
      ),
      mention_count: n.mention_count ?? 0,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return { entries, generated_at: new Date().toISOString() };
}

// Convenience: read graph, derive, save.
export async function buildWikiFromGraph(): Promise<WikiData> {
  const graph = await getGraph();
  if (!graph || graph.nodes.length === 0) {
    throw new Error("No knowledge graph found — build the graph first.");
  }
  const wiki = deriveWikiFromGraph(graph);
  await saveWiki(wiki);
  return wiki;
}
