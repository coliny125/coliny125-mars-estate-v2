import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { PINNED_GOALS_KEY, DEFAULT_PINNED_GOALS } from "@/lib/pinned-goals";
import type { PinnedGoal } from "@/lib/pinned-goals";

export async function GET() {
  const raw = await kv.get<string>(PINNED_GOALS_KEY);
  const goals: PinnedGoal[] = raw
    ? typeof raw === "string"
      ? JSON.parse(raw)
      : (raw as PinnedGoal[])
    : DEFAULT_PINNED_GOALS;
  return NextResponse.json({ goals });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const goals: PinnedGoal[] = (body.goals ?? []).slice(0, 3).map(
    (g: PinnedGoal, i: number) => ({
      id: g.id ?? `pinned-${i + 1}`,
      title: g.title ?? "",
      horizon: g.horizon ?? "",
    })
  );
  await kv.set(PINNED_GOALS_KEY, JSON.stringify(goals));
  return NextResponse.json({ goals });
}
