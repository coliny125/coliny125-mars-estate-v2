import { NextResponse } from "next/server";
import { buildGraphEdges } from "@/lib/graph";
import { getUserId } from "@/lib/auth-util";

// Phase 2 of 2: extract edges between the already-saved nodes. Fits within 60s.
export const maxDuration = 60;

export async function POST() {
  const auth = getUserId();
  if (auth.error) return auth.error;

  try {
    const graph = await buildGraphEdges();
    return NextResponse.json({
      ok: true,
      phase: "edges",
      node_count: graph.nodes.length,
      edge_count: graph.edges.length,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Edge build failed" },
      { status: 500 }
    );
  }
}
