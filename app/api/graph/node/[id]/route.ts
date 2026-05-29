import { NextRequest, NextResponse } from "next/server";
import { getGraph, getNodeDetail } from "@/lib/graph";
import { getUserId } from "@/lib/auth-util";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = getUserId();
  if (auth.error) return auth.error;

  const graph = await getGraph();
  if (!graph) return NextResponse.json({ error: "Graph not built" }, { status: 404 });

  const detail = await getNodeDetail(params.id, graph);
  if (!detail) return NextResponse.json({ error: "Node not found" }, { status: 404 });

  // Find connected nodes
  const connectedNodes = detail.connected_node_ids
    .map((id) => graph.nodes.find((n) => n.id === id))
    .filter(Boolean);

  const edges = graph.edges.filter(
    (e) => e.source === params.id || e.target === params.id
  );

  return NextResponse.json({ node: detail, connected_nodes: connectedNodes, edges });
}
