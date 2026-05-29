import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { runSync, BRIEFING_KEY } from "@/lib/sync";
import type { StoredBriefing, BriefItem } from "@/lib/sync";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const briefing = await kv.get<StoredBriefing>(BRIEFING_KEY);
  if (!briefing) {
    return NextResponse.json({ briefing: null, items: [] });
  }
  const includeHandled =
    req.nextUrl.searchParams.get("include_handled") === "1";
  const items: BriefItem[] = includeHandled
    ? briefing.items
    : briefing.items.filter((i) => !i.handled);
  return NextResponse.json({ briefing, items });
}

export async function POST() {
  try {
    const briefing = await runSync();
    const items = briefing.items.filter((i) => !i.handled);
    return NextResponse.json({ briefing, items });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Sync failed" },
      { status: 500 }
    );
  }
}
