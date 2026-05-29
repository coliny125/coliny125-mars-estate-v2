import { NextResponse } from "next/server";
import { buildWikiFromGraph } from "@/lib/wiki";
import { getUserId } from "@/lib/auth-util";

// Derives the wiki from the knowledge graph (no LLM) — fast, fits the 60s limit.
export const maxDuration = 60;

export async function POST() {
  const auth = getUserId();
  if (auth.error) return auth.error;
  try {
    const wiki = await buildWikiFromGraph();
    return NextResponse.json({ ok: true, entry_count: wiki.entries.length });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Wiki build failed" },
      { status: 500 }
    );
  }
}
