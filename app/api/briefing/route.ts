import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import type { StoredBriefing, BriefItem } from "@/app/api/cron/sync/route";

const BRIEFING_KEY = "briefing:latest";

export async function GET(req: NextRequest) {
  const briefing = await kv.get<StoredBriefing>(BRIEFING_KEY);
  if (!briefing) {
    return NextResponse.json({ briefing: null, items: [] });
  }
  const includeHandled =
    req.nextUrl.searchParams.get("include_handled") === "1";
  const items = includeHandled
    ? briefing.items
    : briefing.items.filter((i) => !i.handled);
  return NextResponse.json({ briefing, items });
}

// Manual trigger from the "Reload" button
export async function POST() {
  const base = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

  const r = await fetch(`${base}/api/cron/sync`, {
    method: "POST",
    headers: { "x-manual-trigger": "1" },
  });
  const data = await r.json();
  if (!r.ok) {
    return NextResponse.json(
      { error: data.error ?? "Sync failed" },
      { status: 500 }
    );
  }
  const briefing = data.briefing as StoredBriefing;
  const items = briefing.items.filter((i: BriefItem) => !i.handled);
  return NextResponse.json({ briefing, items });
}
