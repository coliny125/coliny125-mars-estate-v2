import { NextResponse } from "next/server";
import { buildGraphNodes } from "@/lib/graph";
import { getUserId } from "@/lib/auth-util";
import { todoStore } from "@/lib/storage";
import { kv } from "@vercel/kv";
import { briefingKey } from "@/lib/sync";
import type { StoredBriefing } from "@/lib/sync";

// Phase 1 of 2: extract nodes. Fits within the 60s Hobby limit. The client
// then calls /api/graph/edges to add relationships (phase 2).
export const maxDuration = 60;

export async function POST() {
  const auth = getUserId();
  if (auth.error) return auth.error;
  const { userId } = auth;

  const [briefingRaw, todos] = await Promise.all([
    kv.get<StoredBriefing>(briefingKey(userId)),
    todoStore.list(userId),
  ]);
  const briefingItems = (briefingRaw?.items ?? []).map((i) => `[${i.kind}] ${i.body}`);
  const openTodos = todos.filter((t) => !t.done).map((t) => `[${t.priority}] ${t.text}`);

  try {
    const graph = await buildGraphNodes({ briefingItems, openTodos });
    return NextResponse.json({ ok: true, phase: "nodes", node_count: graph.nodes.length });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Node build failed" },
      { status: 500 }
    );
  }
}
