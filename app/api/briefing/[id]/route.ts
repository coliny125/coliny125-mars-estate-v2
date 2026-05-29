import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { BRIEFING_KEY } from "@/lib/sync";
import type { StoredBriefing } from "@/lib/sync";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { handled } = await req.json();
  const briefing = await kv.get<StoredBriefing>(BRIEFING_KEY);
  if (!briefing) {
    return NextResponse.json({ error: "No briefing" }, { status: 404 });
  }
  const updated: StoredBriefing = {
    ...briefing,
    items: briefing.items.map((item) =>
      item.id === params.id ? { ...item, handled } : item
    ),
  };
  await kv.set(BRIEFING_KEY, updated);
  return NextResponse.json({ ok: true });
}
