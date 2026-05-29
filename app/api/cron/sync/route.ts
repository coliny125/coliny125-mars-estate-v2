import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { runSync, briefingKey } from "@/lib/sync";
import { autoRunResearch, isResearchStale } from "@/lib/research";
import { autoAssessPinnedGoals, areGoalsStale } from "@/lib/goals";
import { getConnectedUsers } from "@/lib/gmail";
import type { StoredBriefing } from "@/lib/sync";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [connectedUsers, researchStale] = await Promise.all([
      getConnectedUsers(),
      isResearchStale(20),
    ]);

    // Sync each connected user in parallel
    const userResults = await Promise.allSettled(
      connectedUsers.map(async (userId) => {
        const goalsStale = await areGoalsStale(userId, 20);
        const [briefing] = await Promise.all([
          runSync(userId, { extended: true }),
          goalsStale
            ? autoAssessPinnedGoals(userId, { extended: true }).catch(() => null)
            : Promise.resolve(null),
        ]);
        return { userId, briefingId: briefing.id };
      })
    );

    // Shared research refresh
    if (researchStale) {
      await autoRunResearch().catch(() => null);
    }

    return NextResponse.json({
      ok: true,
      users_synced: connectedUsers.length,
      research_refreshed: researchStale,
      results: userResults.map((r) =>
        r.status === "fulfilled" ? r.value : { error: r.reason?.message }
      ),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Sync failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  // Return the current user's briefing isn't applicable here (no auth context in cron GET)
  // Return a simple health check instead
  return NextResponse.json({ ok: true });
}
