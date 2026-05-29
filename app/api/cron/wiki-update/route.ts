import { NextRequest, NextResponse } from "next/server";
import { runWeeklyWikiUpdate } from "@/lib/wiki-update";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runWeeklyWikiUpdate();
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Weekly wiki update failed" },
      { status: 500 }
    );
  }
}
