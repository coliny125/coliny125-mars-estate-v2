import { NextResponse } from "next/server";
import { getWiki, deriveWikiFromGraph } from "@/lib/wiki";
import { getGraph } from "@/lib/graph";
import { getUserId } from "@/lib/auth-util";

export async function GET() {
  const auth = getUserId();
  if (auth.error) return auth.error;

  // Prefer the stored (possibly LLM-enriched) wiki; otherwise derive live from the graph.
  let wiki = await getWiki();
  if (!wiki) {
    const graph = await getGraph();
    wiki = graph && graph.nodes.length ? deriveWikiFromGraph(graph) : { entries: [], generated_at: "" };
  }
  return NextResponse.json(wiki);
}
