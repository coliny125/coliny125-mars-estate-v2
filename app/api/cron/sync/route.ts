import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { runSync, BRIEFING_KEY } from "@/lib/sync";
import { autoRunResearch, isResearchStale } from "@/lib/research";
import { autoAssessPinnedGoals, areGoalsStale } from "@/lib/goals";
import type { StoredBriefing } from "@/lib/sync";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [researchStale, goalsStale] = await Promise.all([
      isResearchStale(20),
      areGoalsStale(20),
    ]);

    // Briefing always runs; research + goals run once per day when stale
    const [briefing] = await Promise.all([
      runSync({ extended: true }),
      researchStale ? autoRunResearch().catch(() => null) : Promise.resolve(null),
      goalsStale ? autoAssessPinnedGoals({ extended: true }).catch(() => null) : Promise.resolve(null),
    ]);

    return NextResponse.json({
      ok: true,
      briefing,
      research_refreshed: researchStale,
      goals_refreshed: goalsStale,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Sync failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  const briefing = await kv.get<StoredBriefing>(BRIEFING_KEY);
  return NextResponse.json({ briefing: briefing ?? null });
}
