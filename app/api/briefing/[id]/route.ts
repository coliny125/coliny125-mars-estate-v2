import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { briefingKey } from "@/lib/sync";
import { getUserId } from "@/lib/auth-util";
import type { StoredBriefing } from "@/lib/sync";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = getUserId();
  if (auth.error) return auth.error;

  const { handled } = await req.json();
  const key = briefingKey(auth.userId);
  const briefing = await kv.get<StoredBriefing>(key);
  if (!briefing) return NextResponse.json({ error: "No briefing" }, { status: 404 });

  const updated: StoredBriefing = {
    ...briefing,
    items: briefing.items.map((item) =>
      item.id === params.id ? { ...item, handled } : item
    ),
  };
  await kv.set(key, updated);
  return NextResponse.json({ ok: true });
}
