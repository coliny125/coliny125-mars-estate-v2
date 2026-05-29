import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { runSync, briefingKey } from "@/lib/sync";
import { getUserId } from "@/lib/auth-util";
import type { StoredBriefing, BriefItem } from "@/lib/sync";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const auth = getUserId();
  if (auth.error) return auth.error;

  const briefing = await kv.get<StoredBriefing>(briefingKey(auth.userId));
  if (!briefing) return NextResponse.json({ briefing: null, items: [] });

  const includeHandled = req.nextUrl.searchParams.get("include_handled") === "1";
  const items: BriefItem[] = includeHandled
    ? briefing.items
    : briefing.items.filter((i) => !i.handled);
  return NextResponse.json({ briefing, items });
}

export async function POST() {
  const auth = getUserId();
  if (auth.error) return auth.error;
  try {
    const briefing = await runSync(auth.userId);
    const items = briefing.items.filter((i) => !i.handled);
    return NextResponse.json({ briefing, items });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Sync failed" },
      { status: 500 }
    );
  }
}
