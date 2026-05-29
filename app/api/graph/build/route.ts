import { NextResponse } from "next/server";
import { buildGraph } from "@/lib/graph";
import { getUserId } from "@/lib/auth-util";
import { todoStore } from "@/lib/storage";
import { kv } from "@vercel/kv";
import { briefingKey } from "@/lib/sync";
import type { StoredBriefing } from "@/lib/sync";

export const maxDuration = 60;

export async function POST() {
  const auth = getUserId();
  if (auth.error) return auth.error;
  const { userId } = auth;

  // Gather activity context
  const [briefingRaw, todos] = await Promise.all([
    kv.get<StoredBriefing>(briefingKey(userId)),
    todoStore.list(userId),
  ]);

  const briefingItems = (briefingRaw?.items ?? []).map(
    (i) => `[${i.kind}] ${i.body}`
  );
  const openTodos = todos
    .filter((t) => !t.done)
    .map((t) => `[${t.priority}] ${t.text}`);

  try {
    const graph = await buildGraph(userId, { briefingItems, openTodos });
    return NextResponse.json({
      ok: true,
      node_count: graph.nodes.length,
      edge_count: graph.edges.length,
      built_at: graph.built_at,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Build failed" },
      { status: 500 }
    );
  }
}
