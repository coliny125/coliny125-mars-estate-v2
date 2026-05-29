import Anthropic from "@anthropic-ai/sdk";
import { getConnectedUsers, fetchRecentThreads } from "@/lib/gmail";
import { getGraph, saveGraph } from "@/lib/graph";
import type { GraphData, GraphNode, GraphEdge, NodeType, RelationType } from "@/lib/graph";
import { getWiki, saveWiki, deriveWikiFromGraph } from "@/lib/wiki";
import type { WikiEntry, WikiSection } from "@/lib/wiki";

// Robust JSON object extractor (truncation/garbage tolerant).
function extractObjects<T>(text: string, key: string): T[] {
  const clean = text.replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "");
  const keyIdx = clean.indexOf(`"${key}"`);
  if (keyIdx < 0) return [];
  const bracket = clean.indexOf("[", keyIdx);
  if (bracket < 0) return [];
  const objs: T[] = [];
  let depth = 0, cur = "", inObj = false;
  for (let i = bracket + 1; i < clean.length; i++) {
    const c = clean[i];
    if (c === "{") { if (depth === 0) { inObj = true; cur = ""; } depth++; cur += c; }
    else if (c === "}") { depth--; cur += c; if (depth === 0 && inObj) { try { objs.push(JSON.parse(cur) as T); } catch {} inObj = false; } }
    else if (inObj) cur += c;
    else if (c === "]" && depth === 0) break;
  }
  return objs;
}

interface NewNode { id: string; type: NodeType; label: string; summary: string; sections: WikiSection[] }
interface NewEdge { s: string; t: string; r: RelationType; w?: number }
interface Update { id: string; note: string }

export interface WeeklyUpdateResult {
  ok: boolean;
  emails_scanned: number;
  new_nodes: number;
  new_edges: number;
  updated_entries: number;
}

export async function runWeeklyWikiUpdate(): Promise<WeeklyUpdateResult> {
  const graph = await getGraph();
  if (!graph || graph.nodes.length === 0) {
    return { ok: false, emails_scanned: 0, new_nodes: 0, new_edges: 0, updated_entries: 0 };
  }

  // Pool last week's emails across every connected user. Cap aggressively so
  // the Gmail fetch + single LLM call stay within the 60s function limit.
  const users = await getConnectedUsers();
  const threadLists = await Promise.all(
    users.map((u) => fetchRecentThreads(u, 10, { newerThanDays: 7 }).catch(() => []))
  );
  const threads = threadLists.flat().slice(0, 10);
  if (threads.length === 0) {
    return { ok: true, emails_scanned: 0, new_nodes: 0, new_edges: 0, updated_entries: 0 };
  }

  const emailContext = threads
    .map((t, i) => `[${i + 1}] ${t.subject} — ${t.from}\n${t.body.slice(0, 1200)}`)
    .join("\n\n---\n\n")
    .slice(0, 14000);

  const existingList = graph.nodes.map((n) => `${n.id} (${n.label})`).join(", ");

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const resp = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 3000,
    messages: [
      {
        role: "user",
        content: `You maintain the Mars Estate knowledge graph & wiki. Below are this week's inbox emails. Update the knowledge base.

## Existing entity ids
${existingList}

## This week's emails
${emailContext}

Identify:
1. NEW entities (people, projects, orgs, topics) that appear this week and are NOT already in the list above.
2. NEW relationships between any entities (use exact existing ids, or ids of your new entities).
3. UPDATES: for EXISTING entities with notable news this week, a one-paragraph note.

Node types: person, project, org, topic
Relations: works_at, involved_in, depends_on, related_to, owns, competes_with

Return ONLY compact JSON:
{
  "new_nodes":[{"id":"kebab-id","type":"person","label":"Name","summary":"one sentence","sections":[{"heading":"Overview","body":"2-3 sentences"}]}],
  "new_edges":[{"s":"id","t":"id","r":"works_at","w":3}],
  "updates":[{"id":"existing-id","note":"what changed this week"}]
}
If a category is empty, return []. Only include genuinely new/notable items.`,
      },
    ],
  });
  const text = resp.content.find((b) => b.type === "text");
  const raw = text?.type === "text" ? text.text : "";

  const newNodes = extractObjects<NewNode>(raw, "new_nodes").filter((n) => n && n.id && n.label);
  const newEdges = extractObjects<NewEdge>(raw, "new_edges").filter((e) => e && e.s && e.t);
  const updates = extractObjects<Update>(raw, "updates").filter((u) => u && u.id && u.note);

  const now = new Date().toISOString();
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

  // ── Merge new nodes (dedupe by id and normalized label) ──────────────────────
  const existingIds = new Set(graph.nodes.map((n) => n.id));
  const normToId = new Map<string, string>();
  for (const n of graph.nodes) normToId.set(norm(n.id), n.id);

  const addedNodes: GraphNode[] = [];
  const newArticleById = new Map<string, NewNode>();
  for (const nn of newNodes) {
    if (existingIds.has(nn.id) || normToId.has(norm(nn.id))) continue;
    addedNodes.push({
      id: nn.id,
      type: nn.type,
      label: nn.label,
      description: nn.summary,
      last_seen: now,
      sources: ["weekly-email"],
      mention_count: 0,
    });
    existingIds.add(nn.id);
    normToId.set(norm(nn.id), nn.id);
    newArticleById.set(nn.id, nn);
  }

  const mergedNodes = [...graph.nodes, ...addedNodes];
  const resolve = (id: string) => (existingIds.has(id) ? id : normToId.get(norm(id)) ?? null);

  // ── Merge new edges (resolve endpoints, dedupe against existing) ─────────────
  const edgeKey = (s: string, t: string, r: string) => `${s}|${t}|${r}`;
  const existingEdgeKeys = new Set(graph.edges.map((e) => edgeKey(e.source, e.target, e.relation)));
  const addedEdges: GraphEdge[] = [];
  for (const e of newEdges) {
    const s = resolve(e.s), t = resolve(e.t);
    if (!s || !t || s === t) continue;
    const k = edgeKey(s, t, e.r);
    if (existingEdgeKeys.has(k)) continue;
    existingEdgeKeys.add(k);
    addedEdges.push({ id: `${s}--${e.r}--${t}`, source: s, target: t, relation: e.r, weight: e.w ?? 2, last_active: now });
  }

  const mergedGraph: GraphData = {
    nodes: mergedNodes,
    edges: [...graph.edges, ...addedEdges],
    built_at: now,
  };

  // Recompute degree for heat/sizing
  const degree: Record<string, number> = {};
  for (const e of mergedGraph.edges) {
    degree[e.source] = (degree[e.source] ?? 0) + 1;
    degree[e.target] = (degree[e.target] ?? 0) + 1;
  }
  for (const n of mergedGraph.nodes) n.mention_count = degree[n.id] ?? 0;
  await saveGraph(mergedGraph);

  // ── Rebuild wiki: preserve rich articles, refresh backlinks, add new, apply updates
  const derived = deriveWikiFromGraph(mergedGraph); // gives fresh `related` for every node
  const existingWiki = await getWiki();
  const existingById = new Map((existingWiki?.entries ?? []).map((e) => [e.id, e]));
  const updateById = new Map(updates.map((u) => [resolve(u.id) ?? u.id, u.note]));
  const weekLabel = new Date().toISOString().slice(0, 10);

  let updatedCount = 0;
  const entries: WikiEntry[] = derived.entries.map((d) => {
    const ex = existingById.get(d.id);
    const na = newArticleById.get(d.id);

    // base: existing rich entry, else new article, else lean derived entry
    let base: WikiEntry;
    if (ex) base = { ...ex, related: d.related, mention_count: d.mention_count };
    else if (na) base = { id: d.id, label: d.label, type: d.type, summary: na.summary, sections: na.sections, related: d.related, mention_count: d.mention_count };
    else base = d;

    // apply a weekly update as a dated section (replace any prior weekly update)
    const note = updateById.get(d.id);
    if (note) {
      const sections = base.sections.filter((s) => !s.heading.startsWith("Recent Update"));
      sections.push({ heading: `Recent Update (week of ${weekLabel})`, body: note });
      base = { ...base, sections };
      updatedCount++;
    }
    return base;
  });

  await saveWiki({ entries, generated_at: now });

  return {
    ok: true,
    emails_scanned: threads.length,
    new_nodes: addedNodes.length,
    new_edges: addedEdges.length,
    updated_entries: updatedCount,
  };
}
