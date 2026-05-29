import { NextResponse } from "next/server";
import { getGraph } from "@/lib/graph";
import { getUserId } from "@/lib/auth-util";

export async function GET() {
  const auth = getUserId();
  if (auth.error) return auth.error;
  const graph = await getGraph();
  if (!graph) return NextResponse.json({ nodes: [], edges: [], built_at: null });
  return NextResponse.json(graph);
}
